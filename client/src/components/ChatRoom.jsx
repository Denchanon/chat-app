import { useEffect, useRef, useState } from "react";

const TYPING_THROTTLE = 1500; // SP2: ส่ง "typing" ไม่ถี่กว่าทุก 1.5 วินาที

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// SP4: แสดงรูปในแชท / ไฟล์อื่นเป็นลิงก์ดาวน์โหลด
function Attachment({ file }) {
  if (file.type.startsWith("image/")) {
    return (
      <a href={file.url} target="_blank" rel="noreferrer">
        <img className="attachment-img" src={file.url} alt={file.name} />
      </a>
    );
  }
  return (
    <a className="attachment-file" href={file.url} download={file.name}>
      📄 {file.name} <span className="time">({formatSize(file.size)})</span>
    </a>
  );
}

// R5 + R6: แต่ละห้องมี chat window (แสดงข้อความ) และ chat box (พิมพ์ส่ง)
export default function ChatRoom({ me, roomKey, messages, typingNames, onSend, onSendFile, onTyping }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingNames.length]);

  if (!roomKey) return <main className="chat empty">Select a user or group to start chatting</main>;

  const isGroup = roomKey.startsWith("group:");
  const title = isGroup ? `Group: ${roomKey.slice(6)}` : `Chat with ${roomKey.slice(3)}`;

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSend(text.trim());
    setText("");
    lastTypingSent.current = 0;
  };

  const handleChange = (e) => {
    setText(e.target.value);
    const now = Date.now();
    if (e.target.value && now - lastTypingSent.current > TYPING_THROTTLE) {
      lastTypingSent.current = now;
      onTyping();
    }
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onSendFile(f);
    e.target.value = ""; // ให้เลือกไฟล์เดิมซ้ำได้
  };

  return (
    <main className="chat">
      <header>{title}</header>

      <div className="chat-window">
        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.from === me ? "mine" : ""}`}>
            <span className="from">{m.from}</span>
            {m.text && <span className="text">{m.text}</span>}
            {m.file && <Attachment file={m.file} />}
            <span className="time">{new Date(m.timestamp).toLocaleTimeString()}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* SP2: typing indicator */}
      <div className="typing-bar">
        {typingNames.length > 0 && `${typingNames.join(", ")} กำลังพิมพ์...`}
      </div>

      <form className="chat-box" onSubmit={submit}>
        <input ref={fileInputRef} type="file" hidden onChange={pickFile} />
        <button type="button" className="attach" title="แนบรูป/ไฟล์ (สูงสุด 5 MB)" onClick={() => fileInputRef.current.click()}>
          📎
        </button>
        <input
          placeholder={isGroup ? "Type a message... (พิมพ์ @bot เพื่อถาม AI)" : "Type a message..."}
          value={text}
          onChange={handleChange}
        />
        <button type="submit">Send</button>
      </form>
    </main>
  );
}
