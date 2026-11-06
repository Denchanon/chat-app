import { useEffect, useRef, useState } from "react";
import { Avatar, AiChip, BOT_NAME, colorOf, GroupAvatar, Icon } from "./ui.jsx";

const TYPING_THROTTLE = 1500; // SP2: ส่ง "typing" ไม่ถี่กว่าทุก 1.5 วินาที
const BOT_SUGGESTIONS = ["อธิบาย TCP กับ UDP", "WebSocket ทำงานยังไง", "ช่วยคิดชื่อกลุ่ม"];

const formatTime = (ts) => new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

// ไฮไลต์ @bot ในข้อความ
function MessageText({ text }) {
  const parts = text.split(/(@(?:ai\s*)?bot\b)/i);
  return (
    <div className="msg-text">
      {parts.map((p, i) => (i % 2 ? <span key={i} className="mention">{p}</span> : p))}
    </div>
  );
}

// SP4: รูปแสดงในแชท / ไฟล์อื่นเป็นการ์ดดาวน์โหลด
function Attachment({ file }) {
  if (file.type.startsWith("image/")) {
    return (
      <a className="attach-img" href={file.url} target="_blank" rel="noreferrer" aria-label={`เปิดรูป ${file.name}`}>
        <img src={file.url} alt={file.name} />
        <span className="attach-caption">{file.name} · {formatSize(file.size)}</span>
      </a>
    );
  }
  return (
    <a className="attach-file" href={file.url} download={file.name}>
      <span className="attach-file-icon"><Icon.File width={18} height={18} /></span>
      <span className="attach-file-text">
        <span className="attach-file-name">{file.name}</span>
        <span className="attach-file-size">{formatSize(file.size)}</span>
      </span>
      <Icon.Download width={20} height={20} className="attach-file-dl" />
    </a>
  );
}

function Message({ m, me, showName }) {
  const mine = m.from === me;
  const bot = m.from === BOT_NAME;
  const meta = <div className="msg-time">{formatTime(m.timestamp)}{mine ? " · ส่งแล้ว" : ""}</div>;

  if (mine) {
    return (
      <div className="msg-row mine">
        <div className={`bubble mine ${m.file && !m.text ? "has-media" : ""}`}>
          {m.text && <MessageText text={m.text} />}
          {m.file && <Attachment file={m.file} />}
          {meta}
        </div>
      </div>
    );
  }
  return (
    <div className="msg-row">
      <Avatar name={m.from} size={32} />
      <div className={`bubble ${bot ? "bot" : ""} ${m.file && !m.text ? "has-media" : ""}`}>
        {(showName || bot) && (
          <div className="msg-from" style={bot ? undefined : { color: colorOf(m.from) }}>
            {m.from} {bot && <AiChip />}
          </div>
        )}
        {m.text && <MessageText text={m.text} />}
        {m.file && <Attachment file={m.file} />}
        {meta}
      </div>
    </div>
  );
}

// R5 + R6: แต่ละห้องมี chat window (แสดงข้อความ) และ chat box (พิมพ์ส่ง)
export default function ChatRoom({ me, roomKey, messages, typingNames, group, onlineUsers, onSend, onSendFile, onTyping }) {
  const [text, setText] = useState("");
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);
  const lastTypingSent = useRef(0);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, typingNames.length, roomKey]);

  useEffect(() => {
    setText("");
    inputRef.current?.focus();
  }, [roomKey]);

  if (!roomKey) {
    return (
      <main className="chat empty-state">
        <span className="empty-icon"><Icon.Chat width={32} height={32} /></span>
        <h2>เลือกแชทเพื่อเริ่มคุย</h2>
        <p className="muted">กดชื่อเพื่อนหรือกลุ่มทางซ้าย หรือลองคุยกับ AI Bot</p>
      </main>
    );
  }

  const isGroup = roomKey.startsWith("group:");
  const target = roomKey.slice(roomKey.indexOf(":") + 1);
  const isBot = !isGroup && target === BOT_NAME;
  const botThinking = typingNames.includes(BOT_NAME);
  const othersTyping = typingNames.filter((n) => n !== BOT_NAME); // bot แสดงเป็นฟองจุดในแชทแทน

  const submit = (e) => {
    e.preventDefault();
    if (!text.trim() || (isBot && botThinking)) return;
    onSend(text.trim());
    setText("");
    lastTypingSent.current = 0;
  };

  const handleChange = (e) => {
    setText(e.target.value);
    const now = Date.now();
    if (!isBot && e.target.value && now - lastTypingSent.current > TYPING_THROTTLE) {
      lastTypingSent.current = now;
      onTyping();
    }
  };

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (f) onSendFile(f);
    e.target.value = ""; // ให้เลือกไฟล์เดิมซ้ำได้
  };

  // ---------- header ----------
  let header;
  if (isGroup) {
    const members = group?.members ?? [];
    header = (
      <>
        <div className="chat-title">
          <GroupAvatar name={target} size={44} />
          <div>
            <h1>{target}</h1>
            <div className="muted small">{members.length} สมาชิก · {members.join(", ")}</div>
          </div>
        </div>
        <div className="avatar-stack" aria-label={`สมาชิก: ${members.join(", ")}`}>
          {members.slice(0, 4).map((n) => <Avatar key={n} name={n} size={32} />)}
          {members.length > 4 && <span className="avatar more">+{members.length - 4}</span>}
        </div>
      </>
    );
  } else if (isBot) {
    header = (
      <div className="chat-title">
        <Avatar name={BOT_NAME} size={44} />
        <div>
          <h1>AI Bot <AiChip /></h1>
          <div className="muted small">ขับเคลื่อนด้วย Google Gemini · จำบทสนทนาล่าสุด 10 ข้อความ</div>
        </div>
      </div>
    );
  } else {
    const online = onlineUsers.includes(target);
    header = (
      <div className="chat-title">
        <Avatar name={target} size={44} online={online} />
        <div>
          <h1>{target}</h1>
          <div className="muted small">{online ? "ออนไลน์" : "ออฟไลน์"} · ข้อความเห็นแค่คุณกับ {target}</div>
        </div>
      </div>
    );
  }

  return (
    <main className="chat">
      <header className="chat-header">{header}</header>

      <section className="chat-window" aria-label="ข้อความ" aria-live="polite">
        {isBot && messages.length === 0 && (
          <div className="welcome-card">
            <h2>คุยกับ AI Bot ได้เลย</h2>
            <p className="muted">
              ข้อความในห้องนี้เห็นแค่คุณคนเดียว ถ้าอยากให้ bot ตอบในกลุ่ม พิมพ์ <span className="mention-plain">@bot</span> ในแชทกลุ่ม
            </p>
            <div className="chips">
              {BOT_SUGGESTIONS.map((s) => (
                <button key={s} type="button" className="chip" onClick={() => onSend(s)}>{s}</button>
              ))}
            </div>
          </div>
        )}
        {!isBot && messages.length === 0 && (
          <p className="room-empty muted">
            {isGroup ? "ยังไม่มีข้อความในกลุ่มนี้ ทักทายเลย หรือพิมพ์ @bot เพื่อถาม AI" : `เริ่มคุยกับ ${target} ได้เลย`}
          </p>
        )}

        {messages.map((m, i) => (
          <Message key={i} m={m} me={me} showName={isGroup} />
        ))}

        {/* bot กำลังคิด: แสดงเป็นจุดในฟองข้อความ */}
        {botThinking && (
          <div className="msg-row" role="status" aria-label="AI Bot กำลังพิมพ์">
            <Avatar name={BOT_NAME} size={32} />
            <div className="bubble bot dots"><span /><span /><span /></div>
          </div>
        )}
        <div ref={bottomRef} />
      </section>

      {/* SP2: typing indicator */}
      <div className="typing-bar">
        {othersTyping.length > 0 && (
          <>
            <span className="typing-dots" aria-hidden="true"><span /><span /><span /></span>
            {othersTyping.join(", ")} กำลังพิมพ์…
          </>
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <input ref={fileInputRef} type="file" hidden onChange={pickFile} />
        <button
          type="button"
          className="btn-icon"
          disabled={isBot}
          aria-label={isBot ? "AI Bot อ่านได้แค่ข้อความ แนบไฟล์ไม่ได้" : "แนบรูปหรือไฟล์ (สูงสุด 5 MB)"}
          title={isBot ? "AI Bot อ่านได้แค่ข้อความ" : "แนบรูปหรือไฟล์ (สูงสุด 5 MB)"}
          onClick={() => fileInputRef.current.click()}
        >
          <Icon.Paperclip />
        </button>
        <label htmlFor="msg" className="sr-only">ข้อความ</label>
        <input
          id="msg"
          ref={inputRef}
          autoComplete="off"
          placeholder={
            isBot && botThinking ? "รอ AI Bot ตอบก่อนนะ…" : isGroup ? "พิมพ์ข้อความ… พิมพ์ @bot เพื่อถาม AI" : "พิมพ์ข้อความ…"
          }
          value={text}
          onChange={handleChange}
        />
        <button type="submit" className="btn-primary" disabled={!text.trim() || (isBot && botThinking)}>
          <Icon.Send width={18} height={18} /> ส่ง
        </button>
      </form>
    </main>
  );
}
