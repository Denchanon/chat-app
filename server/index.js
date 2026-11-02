// Chat server — ดู event ทั้งหมดใน docs/protocol.md
import { createServer } from "node:http";
import { Server } from "socket.io";

const PORT = process.env.PORT || 3001;

const httpServer = createServer();
const io = new Server(httpServer, { cors: { origin: "*" } });

// ---------- State ----------
const users = new Map(); // name -> socket.id
const groups = new Map(); // groupName -> { name, owner, members: Set<string> }

const userList = () => [...users.keys()];
const groupList = () =>
  [...groups.values()].map((g) => ({ name: g.name, owner: g.owner, members: [...g.members] }));

const broadcastUsers = () => io.to("registered").emit("users:list", userList());
const broadcastGroups = () => io.to("registered").emit("groups:list", groupList());

const isNameTaken = (name) =>
  [...users.keys()].some((n) => n.toLowerCase() === name.toLowerCase());

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
  socket.on("private:send", ({ to, text } = {}, ack = () => {}) => {
    // TODO(R7):
    // 1. เช็กว่า socket.data.name มีแล้ว และ users มี `to`
    // 2. สร้าง msg = { from, to, text, timestamp: Date.now() }
    // 3. io.to(users.get(to)).emit("private:message", msg) และ socket.emit(...) ให้ผู้ส่ง
    ack({ ok: false, error: "Not implemented" });
  });

  // R8: create group — ตอนสร้างมีแค่ผู้สร้างเป็นสมาชิก
  socket.on("group:create", ({ group } = {}, ack = () => {}) => {
    // TODO(R8):
    // 1. เช็กชื่อกลุ่มไม่ว่าง/ไม่ซ้ำ
    // 2. groups.set(group, { name: group, owner: me, members: new Set([me]) })
    // 3. socket.join(`group:${group}`)
    // 4. broadcastGroups()  (R9)
    ack({ ok: false, error: "Not implemented" });
  });

  // R10: join group ด้วยตัวเอง
  socket.on("group:join", ({ group } = {}, ack = () => {}) => {
    // TODO(R10): เพิ่มตัวเองใน members, socket.join(`group:${group}`), broadcastGroups()
    ack({ ok: false, error: "Not implemented" });
  });

  // R11: group message — ส่งเฉพาะสมาชิก
  socket.on("group:send", ({ group, text } = {}, ack = () => {}) => {
    // TODO(R11):
    // 1. เช็กว่าเป็นสมาชิกของกลุ่ม
    // 2. io.to(`group:${group}`).emit("group:message", { group, from, text, timestamp })
    ack({ ok: false, error: "Not implemented" });
  });

  socket.on("disconnect", () => {
    const name = socket.data.name;
    if (!name) return;
    users.delete(name);
    console.log(`[disconnect] ${name}`);
    broadcastUsers();
    // TODO: ตัดสินใจว่าคนที่ออกยังเป็นสมาชิกกลุ่มอยู่ไหม (ถ้าลบ ให้ broadcastGroups())
  });
});

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Chat server listening on 0.0.0.0:${PORT}`);
});
