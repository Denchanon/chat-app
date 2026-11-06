import { useState } from "react";
import { Avatar, Badge, BOT_NAME, AiChip, GroupAvatar, Icon } from "./ui.jsx";

// ข้อความล่าสุดของห้อง ใช้แสดงใต้ชื่อ
function preview(msgs, me) {
  const last = msgs?.[msgs.length - 1];
  if (!last) return null;
  const who = last.from === me ? "คุณ: " : "";
  if (last.file) return `${who}${last.file.type.startsWith("image/") ? "ส่งรูปภาพ" : "ส่งไฟล์"}`;
  return `${who}${last.text}`;
}

export default function Sidebar({
  me,
  users,
  groups,
  messages,
  activeRoom,
  unread,
  typing,
  onSelectRoom,
  onCreateGroup,
  onJoinGroup,
}) {
  const [newGroup, setNewGroup] = useState("");
  const [query, setQuery] = useState("");

  const create = (e) => {
    e.preventDefault();
    if (!newGroup.trim()) return;
    onCreateGroup(newGroup.trim());
    setNewGroup("");
  };

  const isTyping = (key) => Object.keys(typing[key] || {}).length > 0; // SP2
  const match = (name) => name.toLowerCase().includes(query.trim().toLowerCase());

  // bot บนสุด → ตัวเอง → คนอื่น
  const people = [...users]
    .sort((a, b) => (a === BOT_NAME ? -1 : b === BOT_NAME ? 1 : a === me ? -1 : b === me ? 1 : a.localeCompare(b)))
    .filter(match);
  const groupList = groups.filter((g) => match(g.name));

  return (
    <aside className="sidebar">
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-mark"><Icon.Chat width={20} height={20} /></span>
          <span className="brand-name">Socket Chat</span>
        </div>
        <div className="me-chip" title={`Logged in as ${me}`}>
          <Avatar name={me} size={28} online />
          <span>{me}</span>
        </div>
      </div>

      <div className="search">
        <label htmlFor="search" className="sr-only">ค้นหาแชท</label>
        <Icon.Search width={18} height={18} />
        <input id="search" placeholder="ค้นหาคนหรือกลุ่ม" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      {/* R4: รายชื่อทุกคนที่ online รวมตัวเอง */}
      <nav aria-label="คนที่ออนไลน์" className="side-section">
        <div className="side-heading"><span>Online</span><span>{users.length}</span></div>
        {people.map((u) => {
          const key = `dm:${u}`;
          const isMe = u === me;
          const isBot = u === BOT_NAME;
          const sub = isTyping(key)
            ? "กำลังพิมพ์…"
            : preview(messages[key], me) ?? (isBot ? "ถามอะไรก็ได้ ตอบด้วย Gemini" : isMe ? "นี่คือคุณ" : "ออนไลน์");
          return (
            <button
              key={u}
              type="button"
              className={`side-item ${activeRoom === key ? "active" : ""}`}
              aria-current={activeRoom === key ? "page" : undefined}
              disabled={isMe}
              onClick={() => onSelectRoom(key)}
            >
              <Avatar name={u} online={!isBot} />
              <span className="side-text">
                <span className="side-name">
                  {u}
                  {isBot && <AiChip />}
                  {isMe && <span className="you">(คุณ)</span>}
                </span>
                <span className={`side-sub ${isTyping(key) ? "typing" : ""}`}>{sub}</span>
              </span>
              <Badge count={unread[key]} />
            </button>
          );
        })}
      </nav>

      {/* R9: ทุกกลุ่มพร้อมสมาชิก */}
      <nav aria-label="กลุ่ม" className="side-section">
        <div className="side-heading"><span>Groups</span><span>{groups.length}</span></div>
        {groups.length === 0 && <p className="side-empty">ยังไม่มีกลุ่ม สร้างกลุ่มแรกได้ด้านล่าง</p>}
        {groupList.map((g) => {
          const key = `group:${g.name}`;
          const joined = g.members.includes(me);
          const sub = joined && isTyping(key) ? "มีคนกำลังพิมพ์…" : g.members.join(", ") || "ไม่มีสมาชิก";
          if (!joined) {
            return (
              <div key={g.name} className="side-item static">
                <GroupAvatar name={g.name} muted />
                <span className="side-text">
                  <span className="side-name">{g.name}</span>
                  <span className="side-sub">{sub}</span>
                </span>
                {/* R10: กด join เอง */}
                <button type="button" className="btn-join" onClick={() => onJoinGroup(g.name)}>Join</button>
              </div>
            );
          }
          return (
            <button
              key={g.name}
              type="button"
              className={`side-item ${activeRoom === key ? "active" : ""}`}
              aria-current={activeRoom === key ? "page" : undefined}
              onClick={() => onSelectRoom(key)}
            >
              <GroupAvatar name={g.name} />
              <span className="side-text">
                <span className="side-name">{g.name}</span>
                <span className={`side-sub ${isTyping(key) ? "typing" : ""}`}>{sub}</span>
              </span>
              <Badge count={unread[key]} />
            </button>
          );
        })}
      </nav>

      {/* R8 */}
      <form onSubmit={create} className="new-group">
        <label htmlFor="newgroup" className="sr-only">ชื่อกลุ่มใหม่</label>
        <input id="newgroup" placeholder="ชื่อกลุ่มใหม่" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        <button type="submit" aria-label="สร้างกลุ่ม" className="btn-icon-primary"><Icon.Plus /></button>
      </form>
    </aside>
  );
}
