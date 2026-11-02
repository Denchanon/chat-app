import { useState } from "react";

// R3: ชื่อต้องไม่ซ้ำ — server เป็นคนตัดสิน แล้วตอบ error กลับมา
export default function Login({ onLogin }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    const res = await onLogin(name.trim());
    if (!res.ok) setError(res.error);
  };

  return (
    <form className="login" onSubmit={submit}>
      <h1>Chat App</h1>
      <input
        autoFocus
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <button type="submit">Join</button>
      {error && <p className="error">{error}</p>}
    </form>
  );
}
