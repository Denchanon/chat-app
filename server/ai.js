// AI Bot — Special Point 1 (AI feature)
// ใช้ Google Gemini API (https://ai.google.dev) ผ่าน HTTPS จากฝั่ง server เท่านั้น
// API key อยู่ใน server/.env → ไม่เคยถูกส่งไปที่ client
import { GoogleGenAI } from "@google/genai";

export const BOT_NAME = "AI Bot";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.8-flash";
// (ไม่บังคับ) model สำรอง ใช้เมื่อ model หลักคนใช้เยอะจนตอบไม่ได้ เช่น model ตระกูล flash-lite
const FALLBACK_MODEL = process.env.GEMINI_FALLBACK_MODEL || null;
const RETRY_DELAYS = [1000, 3000]; // ลองใหม่ 2 ครั้ง ห่าง 1 และ 3 วินาที
const MAX_HISTORY = 10; // จำข้อความล่าสุดกี่ข้อความต่อคน (user + bot)

const SYSTEM_PROMPT = `You are "${BOT_NAME}", a friendly assistant inside a student chat application.
Reply in the same language the user writes in (Thai or English).
Keep answers short and conversational: at most a few sentences, plain text, no markdown headings.`;

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: { timeout: 30_000 }, // ถ้า API ไม่ตอบใน 30 วินาที ให้ error แทนการค้าง
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 503 = model คนใช้เยอะชั่วคราว, 429 = เกิน rate limit, 500 = Google error ชั่วคราว → ลองใหม่ได้
const isRetryable = (err) => [429, 500, 503].includes(err?.status);

// เรียก Gemini พร้อม retry และสลับไป model สำรองถ้า model หลักยังล่ม
async function generate(params) {
  const models = FALLBACK_MODEL ? [MODEL, FALLBACK_MODEL] : [MODEL];
  let lastErr;
  for (const model of models) {
    for (let attempt = 0; attempt <= RETRY_DELAYS.length; attempt++) {
      try {
        const res = await ai.models.generateContent({ ...params, model });
        if (model !== MODEL) console.log(`[bot] answered with fallback model ${model}`);
        return res;
      } catch (err) {
        lastErr = err;
        if (!isRetryable(err)) throw err; // เช่น key ผิด / ชื่อ model ผิด → ลองใหม่ก็ไม่หาย
        const delay = RETRY_DELAYS[attempt];
        if (delay === undefined) break; // ครบจำนวนครั้งของ model นี้แล้ว → ไป model ถัดไป
        console.warn(`[bot] ${model} returned ${err.status}, retrying in ${delay / 1000}s`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}

// ประวัติแชทของแต่ละคนกับ bot: name -> [{ role: "user" | "model", parts: [{ text }] }]
const histories = new Map();

export async function askBot(userName, text) {
  const history = histories.get(userName) ?? [];
  const contents = [...history, { role: "user", parts: [{ text }] }];

  const res = await generate({
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

  const res = await generate({
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      systemInstruction: `${SYSTEM_PROMPT}
You are in a group chat. Use the recent messages as context. Address ${from} by name when it fits.`,
    },
  });
  return res.text?.trim() || "(ไม่มีคำตอบ)";
}
