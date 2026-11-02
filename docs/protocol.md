# Chat Protocol (Socket.IO events)

ข้อความแชททุกอย่างระหว่าง client กับ server วิ่งผ่าน Socket.IO (WebSocket บน TCP) เท่านั้น (R2)
**ห้ามเปลี่ยนชื่อ event หรือรูปแบบข้อมูลโดยไม่บอกทีม** เพราะ server กับ client ทำแยกกัน

## Transport
- Server: `http://<server-ip>:3001` (Socket.IO)
- Client: เว็บ React (Vite) port `5173`

## Client → Server

| Event | Payload | Ack (callback) | Requirement |
|---|---|---|---|
| `register` | `{ name: string }` | `{ ok: true }` หรือ `{ ok: false, error: string }` | R3 |
| `private:send` | `{ to: string, text: string }` | `{ ok, error? }` | R7 |
| `group:create` | `{ group: string }` | `{ ok, error? }` | R8 |
| `group:join` | `{ group: string }` | `{ ok, error? }` | R10 |
| `group:send` | `{ group: string, text: string }` | `{ ok, error? }` | R11 |

## Server → Client

| Event | Payload | ส่งให้ใคร | Requirement |
|---|---|---|---|
| `users:list` | `string[]` (ชื่อทุกคนที่ online) | ทุก client ที่ register แล้ว (ทุกครั้งที่มีคนเข้า/ออก) | R4 |
| `groups:list` | `{ name, owner, members: string[] }[]` | ทุก client ที่ register แล้ว (ทุกครั้งที่กลุ่มเปลี่ยน) | R9 |
| `private:message` | `{ from, to, text, timestamp }` | **เฉพาะ** ผู้ส่งและผู้รับ | R7 |
| `group:message` | `{ group, from, text, timestamp }` | **เฉพาะ** สมาชิกในกลุ่ม (Socket.IO room `group:<name>`) | R11 |

`timestamp` = milliseconds (`Date.now()`)

## กติกา
- ชื่อซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) → `register` ตอบ `{ ok: false, error: "Name already taken" }`
- ผู้สร้างกลุ่มเป็นสมาชิกคนแรกและคนเดียวตอนสร้าง (R8) คนอื่นต้อง `group:join` เอง (R10)
- ส่ง `group:send` ได้เฉพาะกลุ่มที่ตัวเองเป็นสมาชิก (server ต้องเช็ก)
- การกรองว่าใครเห็นข้อความ **ทำที่ server** ไม่ใช่ broadcast แล้วให้ client กรอง

## ห้องแชทฝั่ง client (R5)
- Private room key: `dm:<ชื่อคู่สนทนา>`
- Group room key: `group:<ชื่อกลุ่ม>`
