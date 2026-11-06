import { useEffect, useState } from "react";
import { socket } from "../socket.js";
import { Icon } from "./ui.jsx";

const FEATURES = [
  { icon: Icon.Chat, title: "แชทส่วนตัว", desc: "เห็นแค่ผู้ส่งกับผู้รับ" },
  { icon: Icon.Users, title: "กลุ่มแชท", desc: "สร้างเอง กด Join เอง" },
  { icon: Icon.Bot, title: "AI Bot", desc: "ทักส่วนตัว หรือ @bot ในกลุ่ม", warm: true },
  { icon: Icon.Paperclip, title: "รูปและไฟล์", desc: "ส่งได้ไม่เกิน 5 MB" },
];

// R3: ชื่อต้องไม่ซ้ำ — server เป็นคนตัดสิน แล้วตอบ error กลับมา
export default function Login({ onLogin }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(socket.connected);
  const [loading, setLoading] = useState(false);

  // เชื่อมต่อ server ตั้งแต่เปิดหน้า เพื่อโชว์สถานะให้เห็นก่อน login
  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on("connect", on);
    socket.on("disconnect", off);
    socket.on("connect_error", off);
    if (!socket.connected) socket.connect();
    return () => {
      socket.off("connect", on);
      socket.off("disconnect", off);
      socket.off("connect_error", off);
    };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim() || loading) return;
    setLoading(true);
    const res = await onLogin(name.trim());
    setLoading(false);
    if (!res.ok) setError(res.error === "Name already taken" ? "ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่น" : res.error);
  };

  const serverHost = socket.io.uri.replace(/^https?:\/\//, "");

  return (
    <div className="login-page">
      <section className="login-hero">
        <div className="brand">
          <span className="brand-mark lg"><Icon.Chat width={24} height={24} /></span>
          <span className="brand-name lg">Socket Chat</span>
        </div>

        <div className="hero-copy">
          <h1>แชทแบบเรียลไทม์<br />ผ่าน WebSocket</h1>
          <p>คุยส่วนตัว สร้างกลุ่ม ส่งรูปและไฟล์ และถาม AI Bot ได้ในแอปเดียว</p>
        </div>

        <ul className="features">
          {FEATURES.map((f) => (
            <li key={f.title}>
              <span className={`feature-icon ${f.warm ? "warm" : ""}`}><f.icon width={18} height={18} /></span>
              <div>
                <div className="feature-title">{f.title}</div>
                <div className="feature-desc">{f.desc}</div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="login-side">
        <form className="login-card" onSubmit={submit}>
          <div>
            <h2>เข้าสู่แชท</h2>
            <p className="muted">ตั้งชื่อที่จะให้คนอื่นเห็น ชื่อต้องไม่ซ้ำกับคนที่ออนไลน์อยู่</p>
          </div>

          <div className="field">
            <label htmlFor="name">ชื่อที่ใช้แสดง</label>
            <input
              id="name"
              autoFocus
              autoComplete="off"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError("");
              }}
              aria-invalid={!!error}
              aria-describedby={error ? "name-error" : undefined}
              className={error ? "invalid" : ""}
            />
            {error && (
              <div id="name-error" className="field-error">
                <Icon.Alert width={16} height={16} /> {error}
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary lg" disabled={!name.trim() || loading || !connected}>
            {loading ? "กำลังเข้า…" : "เข้าสู่แชท"}
          </button>

          <div className="conn-status">
            <span className={`dot ${connected ? "ok" : "bad"}`} />
            {connected ? `เชื่อมต่อ server แล้ว · ${serverHost}` : `ยังเชื่อมต่อ server ไม่ได้ · ${serverHost}`}
          </div>
        </form>
      </section>
    </div>
  );
}
