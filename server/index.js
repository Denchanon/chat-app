// Chat server — ดู event ทั้งหมดใน docs/protocol.md
import "dotenv/config"; // โหลด server/.env (GEMINI_API_KEY, GEMINI_MODEL) — ต้องอยู่บรรทัดแรกก่อน import อื่น
import { createServer } from "node:http";
import { Server } from "socket.io";
import { BOT_NAME, askBot, forgetUser, mentionsBot, askBotInGroup } from "./ai.js";

const PORT = process.env.PORT || 3001;

const MAX_FILE_SIZE = 5 * 1024 * 1024; // SP4: ไฟล์ใหญ่สุด 5 MB

// Deploy: ตั้ง CLIENT_ORIGIN = URL ของหน้าเว็บ (เช่น https://chat-app.vercel.app) คั่นหลายอันด้วย ,
// ไม่ตั้ง = รับทุก origin (ใช้ตอนรันใน LAN)
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean);

// GET /health → ให้ Railway/Render เช็กว่า server ยังทำงานอยู่ (ข้อความแชทไม่ได้ใช้ HTTP — R2)
const httpServer = createServer((req, res) => {
  if (req.url === "/health") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    return res.end("ok");
  }
  res.writeHead(404).end();
});
const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN?.length ? CLIENT_ORIGIN : "*" },
  maxHttpBufferSize: MAX_FILE_SIZE + 1024 * 1024, // ค่าเริ่มต้น 1 MB → ขยายให้ส่งไฟล์ได้ (+เผื่อ metadata)
});

// ---------- State ----------
const users = new Map(); // name -> socket.id
const groups = new Map(); // groupName -> { name, owner, members: Set<string> }

const botBusy = new Set(); // ชื่อคน / "group:<name>" ที่กำลังรอคำตอบจาก bot (กันส่งรัว → โดน rate limit ของ free tier)
const groupLogs = new Map(); // groupName -> ข้อความล่าสุด [{ from, text }] ให้ bot ใช้เป็น context
const GROUP_LOG_SIZE = 30;

function logGroupMessage(group, from, text) {
  const log = groupLogs.get(group) ?? [];
  log.push({ from, text });
  groupLogs.set(group, log.slice(-GROUP_LOG_SIZE));
}

// R4 + AI: bot แสดงในรายชื่อเหมือน user คนหนึ่ง
const userList = () => [BOT_NAME, ...users.keys()];
const groupList = () =>
  [...groups.values()].map((g) => ({ name: g.name, owner: g.owner, members: [...g.members] }));

const broadcastUsers = () => io.to("registered").emit("users:list", userList());
const broadcastGroups = () => io.to("registered").emit("groups:list", groupList());

// SP4: ตรวจไฟล์ที่แนบมา → คืน { file } ถ้าผ่าน, { error } ถ้าไม่ผ่าน, {} ถ้าไม่มีไฟล์
// Socket.IO ส่ง binary ได้ในตัว: ArrayBuffer จาก browser มาถึง server เป็น Buffer
function checkFile(raw) {
  if (!raw) return {};
  if (!Buffer.isBuffer(raw.data)) return { error: "Invalid file" };
  if (raw.data.length > MAX_FILE_SIZE) return { error: "File is larger than 5 MB" };
  return {
    file: {
      name: String(raw.name ?? "file").slice(0, 200),
      type: String(raw.type || "application/octet-stream"),
      size: raw.data.length,
      data: raw.data,
    },
  };
}

// SP2: bot ส่งสถานะ "กำลังพิมพ์" ซ้ำทุก 2 วินาทีระหว่างรอ AI → คืนฟังก์ชันสำหรับหยุด
function startBotTyping(emitTyping) {
  emitTyping();
  const timer = setInterval(emitTyping, 2000);
  return () => clearInterval(timer);
}

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
  socket.on("private:send", async ({ to, text, file: rawFile } = {}, ack = () => {}) => {
    const from = socket.data.name;
    text = String(text ?? "").trim();
    const { file, error: fileError } = checkFile(rawFile); // SP4

    // 1. ตรวจสอบ: ต้อง login แล้ว, มีข้อความหรือไฟล์
    if (!from) return ack({ ok: false, error: "Not registered" });
    if (fileError) return ack({ ok: false, error: fileError });
    if (!text && !file) return ack({ ok: false, error: "Message is empty" });

    // Special Point 1: แชทกับ AI Bot — ต้องเช็กก่อน users.has(to) เพราะ bot ไม่ได้อยู่ใน users
    if (to === BOT_NAME) {
      if (file) return ack({ ok: false, error: "AI Bot can only read text messages" });
      return handleBotMessage(from, text, ack);
    }

    // ผู้รับต้อง online อยู่
    if (!users.has(to)) return ack({ ok: false, error: `User "${to}" is not online` });

    const msg = { from, to, text, file, timestamp: Date.now() };

    // 2. ส่งให้ผู้รับคนเดียว (หา socket id จากชื่อ)
    io.to(users.get(to)).emit("private:message", msg);

    // 3. ส่งคืนผู้ส่ง เพื่อให้เห็นข้อความตัวเองในห้อง (ถ้าส่งหาตัวเอง ไม่ต้องส่งซ้ำ)
    if (to !== from) socket.emit("private:message", msg);

    // คนอื่นที่ไม่ใช่ผู้ส่ง/ผู้รับ จะไม่ได้รับ event นี้เลย → R7 "only sender and receiver"
    console.log(`[private] ${from} -> ${to}: ${text}${file ? ` [file ${file.name}, ${file.size} B]` : ""}`);
    ack({ ok: true });
  });

  // ส่งข้อความของ user ให้ AI แล้วส่งคำตอบกลับมาในห้อง DM เดียวกัน (เฉพาะ user คนนั้นเห็น)
  async function handleBotMessage(from, text, ack) {
    if (botBusy.has(from)) return ack({ ok: false, error: "AI Bot is still answering, please wait" });

    socket.emit("private:message", { from, to: BOT_NAME, text, timestamp: Date.now() });
    ack({ ok: true }); // ตอบ ack ทันที ไม่ต้องรอ AI → UI ไม่ค้าง
    console.log(`[bot] ${from} -> ${BOT_NAME}: ${text}`);

    botBusy.add(from);
    const stopTyping = startBotTyping(() => socket.emit("typing", { room: `dm:${BOT_NAME}`, from: BOT_NAME }));
    let reply;
    try {
      reply = await askBot(from, text); // HTTPS → Gemini API
    } catch (err) {
      console.error(`[bot] error: ${err.message}`);
      reply = err?.status === 503 || err?.status === 429
        ? "ตอนนี้มีคนใช้ AI เยอะมาก รอสักครู่แล้วลองใหม่อีกครั้งนะ"
        : "ขอโทษครับ ตอนนี้ AI ไม่ว่าง ลองใหม่อีกครั้งนะ";
    } finally {
      stopTyping();
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
  socket.on("group:send", ({ group, text, file: rawFile } = {}, ack = () => {}) => {
    const from = socket.data.name;
    const g = groups.get(group);
    text = String(text ?? "").trim();
    const { file, error: fileError } = checkFile(rawFile); // SP4

    if (!from) return ack({ ok: false, error: "Not registered" });
    if (!g) return ack({ ok: false, error: `Group "${group}" does not exist` });
    if (!g.members.has(from)) return ack({ ok: false, error: "You are not a member of this group" });
    if (fileError) return ack({ ok: false, error: fileError });
    if (!text && !file) return ack({ ok: false, error: "Message is empty" });

    // ส่งเข้า room ของกลุ่ม → เฉพาะ socket ที่ join room นี้ (= สมาชิก) ได้รับ
    io.to(`group:${group}`).emit("group:message", { group, from, text, file, timestamp: Date.now() });
    logGroupMessage(group, from, [text, file && `[ส่งไฟล์ ${file.name}]`].filter(Boolean).join(" "));

    console.log(`[group] ${from} -> "${group}": ${text}${file ? ` [file ${file.name}, ${file.size} B]` : ""}`);
    ack({ ok: true });

    // Special Point 1: ถ้าข้อความมี @bot → ให้ AI ตอบในกลุ่ม
    if (mentionsBot(text)) replyBotInGroup(group, from, text);
  });

  // bot ตอบในกลุ่ม — ส่งเข้า room ของกลุ่มเหมือนข้อความปกติ → สมาชิกเท่านั้นที่เห็น (R11 ยังเป็นจริง)
  async function replyBotInGroup(group, from, text) {
    const busyKey = `group:${group}`;
    const send = (reply) => {
      io.to(busyKey).emit("group:message", { group, from: BOT_NAME, text: reply, timestamp: Date.now() });
      logGroupMessage(group, BOT_NAME, reply);
    };

    if (botBusy.has(busyKey)) return send(`ขอเวลาแป๊บนะ ${from} กำลังตอบคำถามก่อนหน้าอยู่`);

    botBusy.add(busyKey);
    const stopTyping = startBotTyping(() => io.to(busyKey).emit("typing", { room: busyKey, from: BOT_NAME }));
    try {
      const reply = await askBotInGroup(group, groupLogs.get(group) ?? [], from, text); // HTTPS → Gemini API
      stopTyping();
      send(reply);
    } catch (err) {
      stopTyping();
      console.error(`[bot] group error: ${err.message}`);
      send("ขอโทษครับ ตอนนี้ AI ไม่ว่าง ลองใหม่อีกครั้งนะ");
    } finally {
      botBusy.delete(busyKey);
    }
  }

  // SP2: Typing indicator — ส่งต่อสถานะ "กำลังพิมพ์" ให้เฉพาะคนที่อยู่ในห้องเดียวกัน (ไม่ต้องมี ack)
  // room ฝั่งผู้ส่ง: "dm:<คู่สนทนา>" หรือ "group:<ชื่อกลุ่ม>"
  socket.on("typing", ({ room } = {}) => {
    const from = socket.data.name;
    if (!from || typeof room !== "string") return;

    if (room.startsWith("dm:")) {
      const to = room.slice(3);
      // ฝั่งผู้รับ ห้องนี้คือ "dm:<ชื่อผู้ส่ง>"
      if (users.has(to)) io.to(users.get(to)).emit("typing", { room: `dm:${from}`, from });
    } else if (room.startsWith("group:")) {
      const g = groups.get(room.slice(6));
      // socket.to(...) = ส่งให้ทุกคนใน room ยกเว้นตัวเอง
      if (g?.members.has(from)) socket.to(room).emit("typing", { room, from });
    }
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
