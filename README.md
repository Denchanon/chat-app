# chat-app

Computer Network Term Project — Simple Chat Application (Socket Programming)

- **Server:** Node.js + [Socket.IO](https://socket.io/) (`server/`)
- **Client:** React + Vite + socket.io-client (`client/`)
- **Protocol:** ดู [`docs/protocol.md`](docs/protocol.md) ก่อนเขียนโค้ดทุกครั้ง
- **Architecture (R1):** [`docs/architecture.md`](docs/architecture.md)
- **Deploy (Vercel + Railway):** [`docs/deploy.md`](docs/deploy.md)

## วิธีรัน

ต้องมี Node.js 18 ขึ้นไป

```bash
# 1) Server (เครื่องที่เป็น server)
cd server
npm install
cp .env.example .env # แล้วใส่ GEMINI_API_KEY (ขอที่ https://aistudio.google.com)
npm start            # ฟังที่ 0.0.0.0:3001

# 2) Client
cd client
npm install
npm run dev          # เปิดที่ http://<ip-เครื่องนี้>:5173
```

### Demo ข้ามเครื่อง (R1: client อย่างน้อย 2 เครื่อง)
1. ทุกเครื่องต่อ Wi-Fi/LAN วงเดียวกัน
2. หา IP เครื่อง server (`ipconfig` บน Windows, `ifconfig` / `ip a` บน Mac/Linux)
3. รัน server และ client บนเครื่อง server
4. เครื่องอื่นเปิดเบราว์เซอร์ไปที่ `http://<server-ip>:5173`
   - หรือรัน client บนเครื่องตัวเอง แล้วตั้ง `client/.env` เป็น `VITE_SERVER_URL=http://<server-ip>:3001`
5. ถ้าต่อไม่ติด ให้เช็ก firewall ว่าเปิด port 3001 และ 5173

## สถานะ Requirement

| Req | รายละเอียด | ไฟล์หลัก | สถานะ |
|---|---|---|---|
| R1 | Architecture diagram + อธิบาย protocol | [`docs/architecture.md`](docs/architecture.md) | ✅ |
| R2 | ข้อความผ่าน socket เท่านั้น | `server/index.js` | ✅ |
| R3 | ชื่อไม่ซ้ำ | `server/index.js` `register` | ✅ |
| R4 | รายชื่อคนที่ online | `users:list`, `Sidebar.jsx` | ✅ |
| R5 | แต่ละแชทมีห้องของตัวเอง | `App.jsx` (room key) | ✅ UI |
| R6 | chat box + chat window | `ChatRoom.jsx` | ✅ UI |
| R7 | Private message | `private:send` | ✅ |
| R8 | สร้างกลุ่ม | `group:create` | ✅ |
| R9 | เห็นทุกกลุ่ม + สมาชิก | `groups:list` | ✅ |
| R10 | Join กลุ่มเอง | `group:join` | ✅ |
| R11 | Group message | `group:send` | ✅ |
| SP1 | AI Chatbot (Gemini) | `server/ai.js`, `private:send` → `AI Bot` | ✅ |
| SP2 | Typing indicator | `typing` event, `ChatRoom.jsx` | ✅ |
| SP3 | Unread badge | `App.jsx` (`unread`), `Sidebar.jsx` | ✅ |
| SP4 | ส่งรูป/ไฟล์ (≤ 5 MB) | `checkFile` ใน server, `ChatRoom.jsx` | ✅ |

## Workflow ของทีม
- แตก branch จาก `main` ตามฟีเจอร์ เช่น `feature/private-chat`, `feature/groups`, `feature/ai`
- เปิด PR ให้เพื่อนรีวิวก่อน merge
- ถ้าจะเปลี่ยน event หรือ payload ให้แก้ `docs/protocol.md` ใน PR เดียวกัน
- API key ใส่ใน `.env` เท่านั้น ห้าม commit
