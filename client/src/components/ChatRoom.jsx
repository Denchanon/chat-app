import { useEffect, useRef, useState } from "react";

// R5 + R6: แต่ละห้องมี chat window (แสดงข้อความ) และ chat box (พิมพ์ส่ง)
export default function ChatRoom({ me, roomKey, messages, onSend }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!roomKey) return <main className="chat empty">Select a user or group to start chatting</main>;

  const title = roomKey.startsWith("dm:") ? `Chat with ${roomKey.slice(3)}` : `Group: ${roomKey.slice(6)}`;

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <main className="chat">
      <header>{title}</header>

      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from === me ? "mine" : ""}`}>
            <span className="from">{m.from}</span>
            <span className="text">{m.text}</span>
            <span className="time">{new Date(m.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form className="chat-box" onSubmit={submit}>
        <input
          placeholder={roomKey.startsWith("group:") ? "Type a message... (พิมพ์ @bot เพื่อถาม AI)" : "Type a message..."}
          value={text} onChange={(e) => setText(e.target.value)} />
        <button type="submit">Send</button>
      </form>
    </main>
  );
}
