// ไอคอน (SVG) และชิ้นส่วน UI ที่ใช้ร่วมกันหลายหน้า
export const BOT_NAME = "AI Bot"; // ต้องตรงกับ server/ai.js

const base = {
  width: 20,
  height: 20,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
};

export const Icon = {
  Chat: (p) => (
    <svg {...base} {...p}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
  ),
  Search: (p) => (
    <svg {...base} {...p}><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
  ),
  Bot: (p) => (
    <svg {...base} {...p}>
      <rect x="3" y="8" width="18" height="12" rx="3" /><path d="M12 8V4" /><circle cx="12" cy="3" r="1" />
      <line x1="9" y1="13" x2="9" y2="15" /><line x1="15" y1="13" x2="15" y2="15" />
    </svg>
  ),
  Users: (p) => (
    <svg {...base} {...p}>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  Plus: (p) => (
    <svg {...base} {...p}><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
  ),
  Paperclip: (p) => (
    <svg {...base} {...p}>
      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  ),
  Send: (p) => (
    <svg {...base} {...p}><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg>
  ),
  File: (p) => (
    <svg {...base} {...p}>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  Download: (p) => (
    <svg {...base} {...p}>
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  Alert: (p) => (
    <svg {...base} {...p}>
      <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
    </svg>
  ),
};

// สีประจำตัวของแต่ละชื่อ (คงที่ ชื่อเดิมได้สีเดิมเสมอ) — ทุกสีผ่าน contrast กับตัวอักษรสีขาว
const AVATAR_COLORS = ["#0E7490", "#9D174D", "#B45309", "#15803D", "#6D28D9", "#BE123C", "#1D4ED8", "#475569"];
export function colorOf(name) {
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.codePointAt(0)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

export const initials = (name, n = 1) => [...name.trim()].slice(0, n).join("").toUpperCase();

export function Avatar({ name, size = 40, online = false }) {
  if (name === BOT_NAME) {
    return (
      <span className="avatar bot" style={{ width: size, height: size }}>
        <Icon.Bot width={size * 0.55} height={size * 0.55} />
      </span>
    );
  }
  return (
    <span
      className="avatar"
      style={{ width: size, height: size, background: colorOf(name), fontSize: size * 0.38 }}
    >
      {initials(name)}
      {online && <span className="online-dot" />}
    </span>
  );
}

export function GroupAvatar({ name, size = 40, muted = false }) {
  return (
    <span className={`avatar group ${muted ? "muted" : ""}`} style={{ width: size, height: size }}>
      {initials(name, 2)}
    </span>
  );
}

export function Badge({ count }) {
  if (!count) return null;
  return <span className="badge">{count > 99 ? "99+" : count}</span>;
}

export const AiChip = () => <span className="ai-chip">AI</span>;
