import { useState } from "react";

export default function Sidebar({ me, users, groups, activeRoom, onSelectRoom, onCreateGroup, onJoinGroup }) {
  const [newGroup, setNewGroup] = useState("");

  const create = (e) => {
    e.preventDefault();
    if (!newGroup.trim()) return;
    onCreateGroup(newGroup.trim());
    setNewGroup("");
  };

  return (
    <aside className="sidebar">
      <div className="me">Logged in as <b>{me}</b></div>

      {/* R4: รายชื่อทุกคนที่ online รวมตัวเอง */}
      <h3>Online ({users.length})</h3>
      <ul>
        {users.map((u) => (
          <li
            key={u}
            className={activeRoom === `dm:${u}` ? "active" : ""}
            onClick={() => u !== me && onSelectRoom(`dm:${u}`)}
          >
            {u} {u === me && <span className="tag">(you)</span>}
          </li>
        ))}
      </ul>

      {/* R9: ทุกกลุ่มพร้อมสมาชิก */}
      <h3>Groups ({groups.length})</h3>
      <ul>
        {groups.map((g) => {
          const joined = g.members.includes(me);
          return (
            <li key={g.name} className={activeRoom === `group:${g.name}` ? "active" : ""}>
              <div onClick={() => joined && onSelectRoom(`group:${g.name}`)}>
                <b>{g.name}</b>
                <div className="members">{g.members.join(", ")}</div>
              </div>
              {/* R10: กด join เอง */}
              {!joined && <button onClick={() => onJoinGroup(g.name)}>Join</button>}
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
