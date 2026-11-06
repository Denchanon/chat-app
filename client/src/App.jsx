import { useEffect, useRef, useState } from "react";
import { socket } from "./socket.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatRoom from "./components/ChatRoom.jsx";

export const MAX_FILE_SIZE = 5 * 1024 * 1024; // SP4: ต้องตรงกับ server
const TYPING_TIMEOUT = 3000; // SP2: ไม่ได้รับ "typing" เกิน 3 วิ = หยุดพิมพ์แล้ว

// room key: "dm:<name>" หรือ "group:<name>" (ดู docs/protocol.md)
export default function App() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]); // R4
  const [groups, setGroups] = useState([]); // R9
  const [messages, setMessages] = useState({}); // { [roomKey]: msg[] }  R5
  const [activeRoom, setActiveRoom] = useState(null);
  const [unread, setUnread] = useState({}); // SP3: { [roomKey]: จำนวนข้อความที่ยังไม่อ่าน }
  const [typing, setTyping] = useState({}); // SP2: { [roomKey]: { [name]: หมดอายุเมื่อ (ms) } }
  const meRef = useRef(null);
  const activeRoomRef = useRef(null); // ให้ handler ของ socket (สร้างครั้งเดียว) เห็นห้องที่เปิดอยู่ล่าสุด

  useEffect(() => {
    const stopTyping = (key, name) =>
      setTyping((prev) => {
        if (!prev[key]?.[name]) return prev;
        const { [name]: _, ...rest } = prev[key];
        return { ...prev, [key]: rest };
      });

    const addMessage = (key, msg) => {
      // SP4: แปลงไฟล์ (ArrayBuffer) เป็น URL ครั้งเดียวตอนได้รับ เพื่อแสดงรูป / ให้ดาวน์โหลด
      if (msg.file) {
        const blob = new Blob([msg.file.data], { type: msg.file.type });
        msg = { ...msg, file: { ...msg.file, data: undefined, url: URL.createObjectURL(blob) } };
      }
      setMessages((prev) => ({ ...prev, [key]: [...(prev[key] || []), msg] }));

      // SP3: ข้อความจากคนอื่น ในห้องที่ไม่ได้เปิดอยู่ → +1 unread
      if (msg.from !== meRef.current && key !== activeRoomRef.current) {
        setUnread((prev) => ({ ...prev, [key]: (prev[key] || 0) + 1 }));
      }
      stopTyping(key, msg.from); // ส่งข้อความแล้ว = เลิกพิมพ์
    };

    socket.on("users:list", setUsers);
    socket.on("groups:list", setGroups);
    socket.on("private:message", (msg) => {
      const other = msg.from === meRef.current ? msg.to : msg.from;
      addMessage(`dm:${other}`, msg);
    });
    socket.on("group:message", (msg) => addMessage(`group:${msg.group}`, msg));

    // SP2: มีคนกำลังพิมพ์ในห้อง room
    socket.on("typing", ({ room, from }) =>
      setTyping((prev) => ({
        ...prev,
        [room]: { ...prev[room], [from]: Date.now() + TYPING_TIMEOUT },
      })),
    );
    // ลบสถานะที่หมดอายุแล้วทุก 1 วินาที
    const cleaner = setInterval(() => {
      const now = Date.now();
      setTyping((prev) => {
        let changed = false;
        const next = {};
        for (const [room, names] of Object.entries(prev)) {
          next[room] = Object.fromEntries(Object.entries(names).filter(([, exp]) => exp > now));
          if (Object.keys(next[room]).length !== Object.keys(names).length) changed = true;
        }
        return changed ? next : prev;
      });
    }, 1000);

    return () => {
      socket.off("users:list");
      socket.off("groups:list");
      socket.off("private:message");
      socket.off("group:message");
      socket.off("typing");
      clearInterval(cleaner);
    };
  }, []);

  const handleLogin = (name) =>
    new Promise((resolve) => {
      if (!socket.connected) socket.connect();
      socket.emit("register", { name }, (res) => {
        if (res.ok) {
          meRef.current = name;
          setMe(name);
        }
        resolve(res);
      });
    });

  // เปิดห้อง → ล้าง unread ของห้องนั้น (SP3)
  const selectRoom = (key) => {
    activeRoomRef.current = key;
    setActiveRoom(key);
    setUnread((prev) => ({ ...prev, [key]: 0 }));
  };

  // R7 / R11 (+ SP4: แนบไฟล์ได้) — payload = { text } หรือ { file }
  const sendMessage = (payload) => {
    if (!activeRoom) return;
    const sep = activeRoom.indexOf(":");
    const type = activeRoom.slice(0, sep);
    const target = activeRoom.slice(sep + 1);
    if (type === "dm") socket.emit("private:send", { to: target, ...payload }, logError);
    else socket.emit("group:send", { group: target, ...payload }, logError);
  };

  // SP4: อ่านไฟล์เป็น ArrayBuffer แล้วส่งผ่าน socket (Socket.IO ส่ง binary ได้ในตัว)
  const sendFile = async (f) => {
    if (f.size > MAX_FILE_SIZE) return alert("ไฟล์ใหญ่เกิน 5 MB");
    const data = await f.arrayBuffer();
    sendMessage({ file: { name: f.name, type: f.type, data } });
  };

  // SP2: บอก server ว่ากำลังพิมพ์ในห้องนี้ (ChatRoom เป็นคนคุมไม่ให้ส่งถี่เกิน)
  const notifyTyping = () => activeRoom && socket.emit("typing", { room: activeRoom });

  const createGroup = (group) => socket.emit("group:create", { group }, logError); // R8
  const joinGroup = (group) => socket.emit("group:join", { group }, logError); // R10

  if (!me) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <Sidebar
        me={me}
        users={users}
        groups={groups}
        messages={messages}
        activeRoom={activeRoom}
        unread={unread}
        typing={typing}
        onSelectRoom={selectRoom}
        onCreateGroup={createGroup}
        onJoinGroup={joinGroup}
      />
      <ChatRoom
        me={me}
        roomKey={activeRoom}
        messages={messages[activeRoom] || []}
        typingNames={Object.keys(typing[activeRoom] || {})}
        group={activeRoom?.startsWith("group:") ? groups.find((g) => `group:${g.name}` === activeRoom) : null}
        onlineUsers={users}
        onSend={(text) => sendMessage({ text })}
        onSendFile={sendFile}
        onTyping={notifyTyping}
      />
    </div>
  );
}

function logError(res) {
  if (res && !res.ok) alert(res.error);
}
