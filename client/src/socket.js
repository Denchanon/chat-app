import { io } from "socket.io-client";

// ค่าเริ่มต้น: server อยู่เครื่องเดียวกับที่เปิดหน้าเว็บนี้ (port 3001)
// ถ้า server อยู่เครื่องอื่น ตั้ง VITE_SERVER_URL ใน client/.env เช่น http://192.168.1.10:3001
const SERVER_URL =
  import.meta.env.VITE_SERVER_URL || `http://${window.location.hostname}:3001`;

// transports: ["websocket"] → เปิด WebSocket ตรงๆ (ข้าม HTTP long-polling ของ Socket.IO)
// ข้อความแชททั้งหมดจึงวิ่งผ่าน WebSocket connection เดียวที่ค้างไว้ (R2)
export const socket = io(SERVER_URL, { autoConnect: false, transports: ["websocket"] });
