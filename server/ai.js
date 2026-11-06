// AI Bot — Special Point 1 (AI feature)
// ใช้ Google Gemini API (https://ai.google.dev) ผ่าน HTTPS จากฝั่ง server เท่านั้น
// API key อยู่ใน server/.env → ไม่เคยถูกส่งไปที่ client
import { GoogleGenAI } from "@google/genai";

export const BOT_NAME = "AI Bot";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
const MAX_HISTORY = 10; // จำข้อความล่าสุดกี่ข้อความต่อคน (user + bot)

const SYSTEM_PROMPT = `You are "${BOT_NAME}", a friendly assistant inside a student chat application.
Reply in the same language the user writes in (Thai or English).
Keep answers short and conversational: at most a few sentences, plain text, no markdown headings.`;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30_000 }, // ถ้า API ไม่ตอบใน 30 วินาที ให้ error แทนการค้าง
});

// ประวัติแชทของแต่ละคนกับ bot: name -> [{ role: "user" | "model", parts: [{ text }] }]
const histories = new Map();

export async function askBot(userName, text) {
  const history = histories.get(userName) ?? [];
  const contents = [...history, { role: "user", parts: [{ text }] }];

  const res = await ai.models.generateContent({
    model: MODEL,
    contents,
    config: { systemInstruction: SYSTEM_PROMPT },
  });

  const reply = res.text?.trim() || "(ไม่มีคำตอบ)";

  // บันทึกเฉพาะตอนสำเร็จ แล้วเก็บแค่ MAX_HISTORY ข้อความล่าสุด
  contents.push({ role: "model", parts: [{ text: reply }] });
  histories.set(userName, contents.slice(-MAX_HISTORY));
  return reply;
}

export function forgetUser(userName) {
  histories.delete(userName);
}

// ---------- Group chat: เรียกด้วย @bot ----------
// ตรงกับ "@bot", "@Bot", "@ai bot", "@AIBot" ฯลฯ
const MENTION_RE = /@(ai\s*)?bot\b/i;

export const mentionsBot = (text) => MENTION_RE.test(text);

// transcript = ข้อความล่าสุดในกลุ่ม [{ from, text }] (รวมข้อความที่เพิ่งส่งมาด้วย)
// bot เห็นแชทล่าสุดของกลุ่ม → ตอบคำถามที่อ้างถึงบทสนทนาได้ เช่น "@bot สรุปแชทให้หน่อย"
export async function askBotInGroup(groupName, transcript, from, text) {
  const question = text.replace(MENTION_RE, "").trim() || "(ทักทาย)";
  const chatLog = transcript.map((m) => `${m.from}: ${m.text}`).join("\n");

  const prompt = `Recent messages in group chat "${groupName}":
${chatLog}

${from} mentioned you and asked: ${question}`;

  const res = await ai.models.generateContent({
    model: MODEL,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: `${SYSTEM_PROMPT}
You are in a group chat. Use the recent messages as context. Address ${from} by name when it fits.`,
    },
  });
  return res.text?.trim() || "(ไม่มีคำตอบ)";
}
