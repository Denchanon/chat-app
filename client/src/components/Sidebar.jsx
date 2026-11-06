import { useState } from "react";

const BOT_NAME = "AI Bot"; // ต้องตรงกับ server/ai.js

// SP3: ตัวเลขข้อความที่ยังไม่อ่าน
function Badge({ count }) {
  if (!count) return null;
  return <span className="badge">{count > 99 ? "99+" : count}</span>;
}

export default function Sidebar({
  me,
  users,
  groups,
  activeRoom,
  unread,
  typing,
  onSelectRoom,
  onCreateGroup,
  onJoinGroup,
}) {
  const [newGroup, setNewGroup] = useState("");

  const create = (e) => {
    e.preventDefault();
    if (!newGroup.trim()) return;
    onCreateGroup(newGroup.trim());
    setNewGroup("");
  };

  const isTyping = (key) => Object.keys(typing[key] || {}).length > 0; // SP2

  return (
    <aside className="sidebar">
      <div className="me">Logged in as <b>{me}</b></div>

      {/* R4: รายชื่อทุกคนที่ online รวมตัวเอง */}
      <h3>Online ({users.length})</h3>
      <ul>
        {users.map((u) => {
          const key = `dm:${u}`;
          return (
            <li
              key={u}
              className={activeRoom === key ? "active" : ""}
              onClick={() => u !== me && onSelectRoom(key)}
            >
              <div>
                <span>
                  {u === BOT_NAME && "🤖 "}
                  {u}
                </span>
                {isTyping(key) && <div className="typing-hint">กำลังพิมพ์...</div>}
              </div>
              <span className="right">
                {u === me && <span className="tag">(you)</span>}
                {u === BOT_NAME && <span className="tag">AI</span>}
                <Badge count={unread[key]} />
              </span>
            </li>
          );
        })}
      </ul>

      {/* R9: ทุกกลุ่มพร้อมสมาชิก */}
      <h3>Groups ({groups.length})</h3>
      <ul>
        {groups.map((g) => {
          const key = `group:${g.name}`;
          const joined = g.members.includes(me);
          return (
            <li key={g.name} className={activeRoom === key ? "active" : ""}>
              <div onClick={() => joined && onSelectRoom(key)}>
                <b>{g.name}</b>
                <div className="members">{g.members.join(", ")}</div>
                {joined && isTyping(key) && <div className="typing-hint">มีคนกำลังพิมพ์...</div>}
              </div>
              <span className="right">
                {/* R10: กด join เอง */}
                {!joined && <button onClick={() => onJoinGroup(g.name)}>Join</button>}
                <Badge count={unread[key]} />
              </span>
            </li>
          );
        })}
      </ul>

      {/* R8 */}
      <form onSubmit={create} className="new-group">
        <input placeholder="New group name" value={newGroup} onChange={(e) => setNewGroup(e.target.value)} />
        <button type="submit">Create</button>
      </form>
    </aside>
  );
}
