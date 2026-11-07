# Deploy: client → Vercel, server → Railway

```
เบราว์เซอร์ของทุกคน
   │ ① HTTPS: โหลดหน้าเว็บ
   ▼
Vercel (client/)            https://<ชื่อ>.vercel.app
   │
   │ ② WSS (WebSocket + TLS): ข้อความแชททั้งหมด
   ▼
Railway (server/)           https://<ชื่อ>.up.railway.app
   │ ③ HTTPS
   ▼
Google Gemini API (AI Bot)
```

## ทำไม server ไม่ขึ้น Vercel
Vercel รัน server แบบ function ที่แตกเป็นหลาย instance ได้ ทุกครั้งที่เปิดหน้าเว็บ ผู้ใช้อาจไปต่อเข้า instance คนละตัว และ connection จะถูกตัดเมื่อครบเวลาสูงสุด
server เราเก็บ `users`, `groups` และ room ไว้ใน memory ของ process เดียว ถ้าแยก instance กัน คนจะมองไม่เห็นกัน ทำให้ R4, R7 และ R11 พัง
Railway รัน server เป็น **process เดียวที่เปิดค้างตลอด** เหมือนตอนรัน `npm start` ในเครื่อง โค้ดจึงไม่ต้องแก้เลย

---

## ขั้นที่ 1: Server บน Railway (ทำก่อน)
1. เข้า railway.com แล้ว login ด้วย GitHub
2. **New Project → Deploy from GitHub repo →** เลือก `Denchanon/chat-app`
3. เข้าไปที่ service ที่สร้างขึ้น → **Settings**
   - **Root Directory:** `server`
   - Start Command ปล่อยว่างไว้ได้ (Railway ใช้ `npm start` ให้เอง)
4. **Variables** ใส่ค่าเหล่านี้:
   | ชื่อ | ค่า |
   |---|---|
   | `GEMINI_API_KEY` | key ของคุณ |
   | `GEMINI_MODEL` | `gemini-3.8-flash` |
   | `GEMINI_FALLBACK_MODEL` | (ไม่บังคับ) model สำรองเมื่อ model หลักตอบ 503 |
   ไม่ต้องตั้ง `PORT` เพราะ Railway ตั้งให้อัตโนมัติ
5. **Settings → Networking → Generate Domain** จะได้ URL หน้าตาประมาณ `https://chat-app-production-xxxx.up.railway.app`
6. ทดสอบโดยเปิด `https://<URL>/health` ถ้าขึ้น `ok` แปลว่า server ทำงานแล้ว

## ขั้นที่ 2: Client บน Vercel
1. เข้า vercel.com แล้ว login ด้วย GitHub
2. **Add New → Project →** import `Denchanon/chat-app`
3. ตั้งค่า:
   - **Root Directory:** `client`
   - Framework Preset: **Vite** (Vercel มักเลือกให้เอง)
   - **Environment Variables:** `VITE_SERVER_URL` = URL ของ Railway จากขั้นที่ 1 (ขึ้นต้นด้วย `https://` และไม่มี `/` ปิดท้าย)
4. กด **Deploy** จะได้ URL หน้าตาประมาณ `https://chat-app-xxxx.vercel.app`

> `VITE_SERVER_URL` ถูกฝังลงในไฟล์ตอน build ถ้าแก้ค่านี้ภายหลัง ต้อง **Redeploy** ใหม่ใน Vercel ถึงจะมีผล

## ขั้นที่ 3: ล็อกให้ server รับเฉพาะหน้าเว็บของเรา
ที่ Railway ไปที่ **Variables** แล้วเพิ่ม:
| ชื่อ | ค่า |
|---|---|
| `CLIENT_ORIGIN` | URL ของ Vercel เช่น `https://chat-app-xxxx.vercel.app` |

Railway จะ deploy ใหม่ให้เอง ถ้ามีหลาย URL ให้คั่นด้วย `,`

## ขั้นที่ 4: ทดสอบ
- เปิดลิงก์ Vercel บนคอม 2 เครื่อง (หรือคอมกับมือถือ) ต่อเน็ตคนละวงก็ได้
- หน้า Login ต้องขึ้นจุดสีเขียว "เชื่อมต่อ server แล้ว · ….up.railway.app"
- ไล่ทดสอบ R3–R11 กับ SP1–SP4 ให้ครบ

## ถ้ามีปัญหา
| อาการ | สาเหตุ / วิธีแก้ |
|---|---|
| หน้า Login ขึ้นจุดแดง | `VITE_SERVER_URL` ผิด (ลืม `https://` หรือมี `/` ปิดท้าย) หรือแก้แล้วแต่ยังไม่ได้ Redeploy |
| จุดแดง และ console ขึ้น CORS | `CLIENT_ORIGIN` ไม่ตรงกับ URL ของ Vercel ทุกตัวอักษร |
| `/health` เปิดไม่ขึ้น | ดู Deploy Logs ใน Railway และเช็กว่า Root Directory เป็น `server` |
| AI Bot ตอบว่า "ไม่ว่าง" | ยังไม่ได้ตั้ง `GEMINI_API_KEY` หรือ key ผิด ดู log บรรทัด `[bot] error:` |
| log ขึ้น `503 ... high demand` | Gemini คนใช้เยอะชั่วคราว (ไม่ใช่ bug) server ลองใหม่ให้เอง 2 ครั้ง ถ้ายังไม่หาย ให้ตั้ง `GEMINI_FALLBACK_MODEL` |

## ข้อควรรู้
- **ข้อมูลอยู่ใน memory:** Railway restart หรือ deploy ใหม่เมื่อไหร่ รายชื่อ กลุ่ม และประวัติแชทกับ bot จะหายหมด ทุกคนต้อง login ใหม่ (ระบบออกแบบไว้แบบนี้อยู่แล้ว)
- **ใครมีลิงก์ก็เข้าได้:** ระบบไม่มีรหัสผ่าน และ AI Bot ใช้โควตา Gemini ของคุณ ควรแชร์ลิงก์เฉพาะคนที่ต้องการให้ใช้
- **ค่าใช้จ่าย:** Railway คิดตามการใช้งาน มี credit ให้ทดลองใช้ ควรเช็กเงื่อนไขในหน้า pricing ก่อนสมัคร ส่วน Vercel ใช้แผน Hobby ได้ฟรีสำหรับงานส่วนตัว
- **Demo ในห้อง:** เตรียมแบบรันบน LAN (ตาม README) ไว้สำรอง เผื่อเน็ตในห้องมีปัญหา
- **คะแนน:** โจทย์ระบุว่า cloud deployment นับเป็น special point ได้ 1 ข้อ
