// Chat server — ดู event ทั้งหมดใน docs/protocol.md
import "dotenv/config"; // โหลด server/.env (GEMINI_API_KEY, GEMINI_MODEL) — ต้องอยู่บรรทัดแรกก่อน import อื่น
import { createServer } from "node:http";
import { Server } from "socket.io";
import { BOT_NAME, askBot, forgetUser } from "./ai.js";

const PORT = process.env.PORT || 3001;

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

// ---------- State ----------
const users = new Map(); // name -> socket.id
const groups = new Map(); // groupName -> { name, owner, members: Set<string> }

const botBusy = new Set(); // ชื่อคนที่กำลังรอคำตอบจาก bot (กันส่งรัว → โดน rate limit ของ free tier)

// R4 + AI: bot แสดงในรายชื่อเหมือน user คนหนึ่ง
const userList = () => [BOT_NAME, ...users.keys()];
const groupList = () =>
  [...groups.values()].map((g) => ({ name: g.name, owner: g.owner, members: [...g.members] }));

const broadcastUsers = () => io.to("registered").emit("users:list", userList());
const broadcastGroups = () => io.to("registered").emit("groups:list", groupList());

const isNameTaken = (name) =>
  [BOT_NAME, ...users.keys()].some((n) => n.toLowerCase() === name.toLowerCase()); // ห้ามใช้ชื่อซ้ำกับ bot ด้วย

// ---------- Connection ----------
io.on("connection", (socket) => {
  console.log(`[connect] ${socket.id} from ${socket.handshake.address}`);

  // R3: unique name
  socket.on("register", ({ name } = {}, ack = () => {}) => {
    name = String(name ?? "").trim();
    if (!name) return ack({ ok: false, error: "Name is required" });
    if (socket.data.name) return ack({ ok: false, error: "Already registered" });
    if (isNameTaken(name)) return ack({ ok: false, error: "Name already taken" });

    socket.data.name = name;
    users.set(name, socket.id);
    socket.join("registered");
    ack({ ok: true });

    console.log(`[register] ${name}`);
    broadcastUsers(); // R4
    socket.emit("groups:list", groupList()); // R9
  });

  // R7: private message — ส่งเฉพาะผู้ส่งและผู้รับ
  socket.on("private:send", async ({ to, text } = {}, ack = () => {}) => {
    const from = socket.data.name;
    text = String(text ?? "").trim();

    // 1. ตรวจสอบ: ต้อง login แล้ว, มีข้อความ
    if (!from) return ack({ ok: false, error: "Not registered" });
    if (!text) return ack({ ok: false, error: "Message is empty" });

    // Special Point 1: แชทกับ AI Bot — ต้องเช็กก่อน users.has(to) เพราะ bot ไม่ได้อยู่ใน users
    if (to === BOT_NAME) return handleBotMessage(from, text, ack);

    // ผู้รับต้อง online อยู่
    if (!users.has(to)) return ack({ ok: false, error: `User "${to}" is not online` });

    const msg = { from, to, text, timestamp: Date.now() };

    // 2. ส่งให้ผู้รับคนเดียว (หา socket id จากชื่อ)
    io.to(users.get(to)).emit("private:message", msg);

    // 3. ส่งคืนผู้ส่ง เพื่อให้เห็นข้อความตัวเองในห้อง (ถ้าส่งหาตัวเอง ไม่ต้องส่งซ้ำ)
    if (to !== from) socket.emit("private:message", msg);

    // คนอื่นที่ไม่ใช่ผู้ส่ง/ผู้รับ จะไม่ได้รับ event นี้เลย → R7 "only sender and receiver"
    console.log(`[private] ${from} -> ${to}: ${text}`);
    ack({ ok: true });
  });

  // ส่งข้อความของ user ให้ AI แล้วส่งคำตอบกลับมาในห้อง DM เดียวกัน (เฉพาะ user คนนั้นเห็น)
  async function handleBotMessage(from, text, ack) {
    if (botBusy.has(from)) return ack({ ok: false, error: "AI Bot is still answering, please wait" });

    socket.emit("private:message", { from, to: BOT_NAME, text, timestamp: Date.now() });
    ack({ ok: true }); // ตอบ ack ทันที ไม่ต้องรอ AI → UI ไม่ค้าง
    console.log(`[bot] ${from} -> ${BOT_NAME}: ${text}`);

    botBusy.add(from);
    let reply;
    try {
      reply = await askBot(from, text); // HTTPS → Gemini API
    } catch (err) {
      console.error(`[bot] error: ${err.message}`);
      reply = "ขอโทษครับ ตอนนี้ AI ไม่ว่าง ลองใหม่อีกครั้งนะ";
    } finally {
      botBusy.delete(from);
    }

    // user อาจออกไปแล้วระหว่างรอ AI
    if (!socket.connected) return;
    socket.emit("private:message", { from: BOT_NAME, to: from, text: reply, timestamp: Date.now() });
  }

  // R8: create group — ตอนสร้างมีแค่ผู้สร้างเป็นสมาชิก
  socket.on("group:create", ({ group } = {}, ack = () => {}) => {
    const me = socket.data.name;
    group = String(group ?? "").trim();

    if (!me) return ack({ ok: false, error: "Not registered" });
    if (!group) return ack({ ok: false, error: "Group name is required" });
    if (groups.has(group)) return ack({ ok: false, error: "Group name already taken" });

    // สมาชิกเริ่มต้นมีแค่ผู้สร้างคนเดียว (R8)
    groups.set(group, { name: group, owner: me, members: new Set([me]) });
    socket.join(`group:${group}`); // เข้า Socket.IO room ของกลุ่ม → จะได้รับ group:message

    console.log(`[group:create] ${me} created "${group}"`);
    ack({ ok: true });
    broadcastGroups(); // R9: ทุกคนเห็นกลุ่มใหม่
  });

  // R10: join group ด้วยตัวเอง — ไม่มี event ให้ใครเพิ่มคนอื่นเข้ากลุ่ม
  socket.on("group:join", ({ group } = {}, ack = () => {}) => {
    const me = socket.data.name;
    const g = groups.get(group);

    if (!me) return ack({ ok: false, error: "Not registered" });
    if (!g) return ack({ ok: false, error: `Group "${group}" does not exist` });
    if (g.members.has(me)) return ack({ ok: false, error: "Already a member" });

    g.members.add(me); // เพิ่มได้แค่ตัวเอง (ใช้ชื่อจาก socket ไม่ใช่จาก payload)
    socket.join(`group:${group}`);

    console.log(`[group:join] ${me} joined "${group}"`);
    ack({ ok: true });
    broadcastGroups(); // R9: อัปเดตรายชื่อสมาชิกให้ทุกคน
  });

  // R11: group message — ส่งเฉพาะสมาชิก
  socket.on("group:send", ({ group, text } = {}, ack = () => {}) => {
    const from = socket.data.name;
    const g = groups.get(group);
    text = String(text ?? "").trim();

    if (!from) return ack({ ok: false, error: "Not registered" });
    if (!g) return ack({ ok: false, error: `Group "${group}" does not exist` });
    if (!g.members.has(from)) return ack({ ok: false, error: "You are not a member of this group" });
    if (!text) return ack({ ok: false, error: "Message is empty" });

    // ส่งเข้า room ของกลุ่ม → เฉพาะ socket ที่ join room นี้ (= สมาชิก) ได้รับ
    io.to(`group:${group}`).emit("group:message", { group, from, text, timestamp: Date.now() });

    console.log(`[group] ${from} -> "${group}": ${text}`);
    ack({ ok: true });
  });

  socket.on("disconnect", () => {
    const name = socket.data.name;
    if (!name) return;
    users.delete(name);
    forgetUser(name); // ลบประวัติแชทกับ bot
    console.log(`[disconnect] ${name}`);
    broadcastUsers();

    // คนที่ออกไปจะหลุดจากทุกกลุ่ม (socket ใหม่ตอนกลับมาไม่ได้อยู่ใน room เดิม)
    // กลุ่มยังอยู่ แม้สมาชิกจะเหลือ 0 คน คนอื่นยัง join ได้
    let changed = false;
    for (const g of groups.values()) {
      if (g.members.delete(name)) changed = true;
    }
    if (changed) broadcastGroups();
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Chat server listening on 0.0.0.0:${PORT}`);
});
