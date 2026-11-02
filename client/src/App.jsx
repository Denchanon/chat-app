import { useEffect, useRef, useState } from "react";
import { socket } from "./socket.js";
import Login from "./components/Login.jsx";
import Sidebar from "./components/Sidebar.jsx";
import ChatRoom from "./components/ChatRoom.jsx";

// room key: "dm:<name>" หรือ "group:<name>" (ดู docs/protocol.md)
export default function App() {
  const [me, setMe] = useState(null);
  const [users, setUsers] = useState([]); // R4
  const [groups, setGroups] = useState([]); // R9
  const [messages, setMessages] = useState({}); // { [roomKey]: msg[] }  R5
  const [activeRoom, setActiveRoom] = useState(null);
  const meRef = useRef(null);

  useEffect(() => {
    const addMessage = (key, msg) =>
      setMessages((prev) => ({ ...prev, [key]: [...(prev[key] || []), msg] }));

    socket.on("users:list", setUsers);
    socket.on("groups:list", setGroups);
    socket.on("private:message", (msg) => {
      const other = msg.from === meRef.current ? msg.to : msg.from;
      addMessage(`dm:${other}`, msg);
    });
    socket.on("group:message", (msg) => addMessage(`group:${msg.group}`, msg));

    return () => {
      socket.off("users:list");
      socket.off("groups:list");
      socket.off("private:message");
      socket.off("group:message");
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

  // R7 / R11
  const sendMessage = (text) => {
    if (!activeRoom) return;
    const sep = activeRoom.indexOf(":");
    const type = activeRoom.slice(0, sep);
    const target = activeRoom.slice(sep + 1);
    if (type === "dm") socket.emit("private:send", { to: target, text }, logError);
    else socket.emit("group:send", { group: target, text }, logError);
  };

  const createGroup = (group) => socket.emit("group:create", { group }, logError); // R8
  const joinGroup = (group) => socket.emit("group:join", { group }, logError); // R10

  if (!me) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <Sidebar
        me={me}
        users={users}
        groups={groups}
        activeRoom={activeRoom}
        onSelectRoom={setActiveRoom}
        onCreateGroup={createGroup}
        onJoinGroup={joinGroup}
      />
      <ChatRoom
        me={me}
        roomKey={activeRoom}
        messages={messages[activeRoom] || []}
        onSend={sendMessage}
      />
    </div>
  );
}

function logError(res) {
  if (res && !res.ok) alert(res.error);
}
