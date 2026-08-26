export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const GEMINI_KEY = process.env.GEMINI_API_KEY;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
const USER_PHONE = process.env.USER_PHONE;

interface Task {
  id: string;
  name: string;
  emoji: string;
  time: string;
  date: string;
  theme: "hype" | "zen";
}

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  totalCompleted: number;
}

const tasks: Task[] = [];
let streak: StreakData = { currentStreak: 0, longestStreak: 0, lastCompletedDate: null, totalCompleted: 0 };
const conversationHistory: Map<number, string[]> = new Map();

const SYSTEM_PROMPT = `You are Jarvis, a friendly personal assistant and accountability buddy. You help the user manage their daily tasks and schedule.

PERSONALITY:
- Casual, friendly, like talking to a close buddy
- Motivating and encouraging
- Use emojis naturally but not excessively
- Short, punchy responses

TASKS:
1. Add tasks: respond with TASK_ADD: [name] | [time] | [date]
2. Delete tasks: TASK_DELETE: [name]
3. View schedule: TASK_VIEW: [date]
4. General chat

EXAMPLES:
User: "how are you?"
You: "I'm great buddy! Ready to crush today? 💪"

User: "hey add gym for tomorrow 5:30"
You: "Done!\nTASK_ADD: gym | 5:30 | tomorrow\nYou're going to CRUSH it! 💪"

User: "what's my schedule tomorrow"
You: "TASK_VIEW: tomorrow\nLet me check your day! 🔥"

User: "motivate me"
You: "You started this journey for a REASON. Every rep, every early morning - it's building YOUR success story! 🚀"

User: "I'm tired"
You: "Tired is just a feeling, not a fact. You're STRONGER than you think! 💪"`;

function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("gym") || n.includes("workout")) return "🏋️";
  if (n.includes("work") || n.includes("office") || n.includes("meeting")) return "💼";
  if (n.includes("class") || n.includes("study") || n.includes("learn")) return "📚";
  if (n.includes("wake") || n.includes("morning")) return "🌅";
  if (n.includes("run") || n.includes("jog")) return "🏃";
  if (n.includes("eat") || n.includes("food") || n.includes("breakfast")) return "🍽️";
  if (n.includes("read")) return "📖";
  if (n.includes("code") || n.includes("develop")) return "💻";
  return "⚡";
}

function getTheme(name: string, time: string): "hype" | "zen" {
  const hour = parseInt(time.split(":")[0]);
  if (hour >= 4 && hour < 7) return "zen";
  if (name.toLowerCase().includes("gym") || name.toLowerCase().includes("work")) return "hype";
  return "hype";
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

async function sendTelegram(chatId: number | string, text: string): Promise<void> {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
  } catch (e) {
    console.error("Telegram send failed:", e);
  }
}

async function sendSMS(body: string): Promise<void> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM || !USER_PHONE) return;
  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64");
    await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Authorization: `Basic ${auth}`,
      },
      body: new URLSearchParams({
        From: TWILIO_FROM,
        To: USER_PHONE,
        Body: body,
      }).toString(),
    });
    console.log("SMS sent:", body.substring(0, 50));
  } catch (e) {
    console.error("SMS failed:", e);
  }
}

async function getAIResponse(chatId: number, message: string): Promise<string> {
  try {
    if (!GEMINI_KEY) return "AI not configured yet!";

    const { GoogleGenerativeAI } = await import("@google/generative-ai");
    const genAI = new GoogleGenerativeAI(GEMINI_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-3.6-flash" });

    if (!conversationHistory.has(chatId)) conversationHistory.set(chatId, []);
    const history = conversationHistory.get(chatId)!;
    history.push(message);
    if (history.length > 20) history.splice(0, history.length - 20);

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: SYSTEM_PROMPT }] },
        { role: "model", parts: [{ text: "Got it! I'm Jarvis, your buddy! 💪" }] },
      ],
    });

    const result = await chat.sendMessage(message);
    const reply = result.response.text();
    history.push(reply);
    return reply;
  } catch (e: any) {
    console.error("AI error:", e.message);
    return "My brain had a hiccup! Try again 🧠";
  }
}

function parseAddCommand(text: string): { name: string; time: string } | null {
  const lower = text.toLowerCase().replace(/^\/add\s+/, "").trim();
  const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
  if (!timeMatch) return null;

  let hours = parseInt(timeMatch[1] || "0");
  const minutes = timeMatch[2] || "00";
  const ampm = timeMatch[3] || "";
  if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
  if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;

  const time = `${hours.toString().padStart(2, "0")}:${minutes.padStart(2, "0")}`;
  const name = lower.replace(timeMatch[0], "").trim();
  return name ? { name, time } : null;
}

function addTask(name: string, time: string, date?: string): Task {
  const task: Task = {
    id: `task_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    name: name.trim(),
    emoji: getEmoji(name),
    time,
    date: date || getTomorrowDate(),
    theme: getTheme(name, time),
  };
  tasks.push(task);
  return task;
}

function updateStreak(completed: boolean): StreakData {
  const today = getTodayDate();
  if (!completed) {
    streak.currentStreak = 0;
    return streak;
  }
  if (streak.lastCompletedDate === today) {
    streak.totalCompleted++;
    return streak;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (streak.lastCompletedDate === yesterday.toISOString().split("T")[0]) {
    streak.currentStreak++;
  } else {
    streak.currentStreak = 1;
  }
  if (streak.currentStreak > streak.longestStreak) streak.longestStreak = streak.currentStreak;
  streak.lastCompletedDate = today;
  streak.totalCompleted++;
  return streak;
}

function getStreakMessage(): string {
  if (streak.currentStreak === 0) return "No active streak. Start today! 💪";
  return `🔥 Current: ${streak.currentStreak} days\n🏆 Best: ${streak.longestStreak} days\n✅ Total: ${streak.totalCompleted} tasks`;
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";
      if (!text) return NextResponse.json({ ok: true });

      // Store chat ID for notifications
      process.env.USER_CHAT_ID = String(chatId);

      // Commands
      if (text === "/start") {
        await sendTelegram(chatId, "Hey! 👋 I'm Jarvis!\n\n💬 Talk to me naturally!\n📝 /add gym 5:30\n📋 /schedule\n🔥 /streak\n💪 /motivate\n\nJust chat with me like a friend!");
        return NextResponse.json({ ok: true });
      }

      if (text === "/help") {
        await sendTelegram(chatId, "📋 Commands:\n\n/add [task] [time] - Add task\n/schedule - View tasks\n/done - Mark complete\n/streak - Check streak\n/remove [task] - Remove\n\nOr just talk naturally! 💬");
        return NextResponse.json({ ok: true });
      }

      if (text === "/schedule") {
        const today = tasks.filter((t) => t.date === getTodayDate());
        const tomorrow = tasks.filter((t) => t.date === getTomorrowDate());
        let msg = "📋 Schedule:\n\n";
        if (today.length) msg += "Today:\n" + today.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n") + "\n\n";
        if (tomorrow.length) msg += "Tomorrow:\n" + tomorrow.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n");
        if (!today.length && !tomorrow.length) msg = "No tasks! Add some: /add gym 5:30 📝";
        await sendTelegram(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      if (text === "/done") {
        updateStreak(true);
        await sendTelegram(chatId, `✅ Task completed!\n\n${getStreakMessage()}`);
        return NextResponse.json({ ok: true });
      }

      if (text === "/streak") {
        await sendTelegram(chatId, getStreakMessage());
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith("/add")) {
        const parsed = parseAddCommand(text);
        if (!parsed) {
          await sendTelegram(chatId, "❌ Usage: /add gym 5:30");
          return NextResponse.json({ ok: true });
        }
        const task = addTask(parsed.name, parsed.time);
        await sendTelegram(chatId, `${task.emoji} ${task.name} added for ${task.time}! 💪`);
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith("/remove")) {
        const name = text.replace("/remove", "").trim().toLowerCase();
        const found = tasks.find((t) => t.name.toLowerCase().includes(name));
        if (found) {
          const idx = tasks.indexOf(found);
          tasks.splice(idx, 1);
          await sendTelegram(chatId, `${found.emoji} ${found.name} removed! ✅`);
        } else {
          await sendTelegram(chatId, `Can't find "${name}". Check /schedule`);
        }
        return NextResponse.json({ ok: true });
      }

      // AI Chat
      const reply = await getAIResponse(chatId, text);

      if (reply.includes("TASK_ADD:")) {
        const match = reply.match(/TASK_ADD:\s*(.+?)\s*\|\s*(.+?)\s*\|\s*(.+)/);
        if (match) {
          const task = addTask(match[1] || "", match[2] || "", (match[3] || "tomorrow").trim() === "tomorrow" ? getTomorrowDate() : getTodayDate());
          const clean = reply.replace(/TASK_ADD:\s*.+?\|\s*.+?\|\s*.+/, "").trim();
          await sendTelegram(chatId, clean || `${task.emoji} ${task.name} added for ${task.time}! 💪`);
          return NextResponse.json({ ok: true });
        }
      }

      if (reply.includes("TASK_VIEW:")) {
        const match = reply.match(/TASK_VIEW:\s*(.+)/);
        if (match) {
          const d = (match[1] || "").trim() === "tomorrow" ? getTomorrowDate() : getTodayDate();
          const dayTasks = tasks.filter((t) => t.date === d);
          const clean = reply.replace(/TASK_VIEW:\s*.+/, "").trim();
          if (dayTasks.length) {
            await sendTelegram(chatId, `${clean}\n\n${dayTasks.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n")}`);
          } else {
            await sendTelegram(chatId, clean || "No tasks! Add some 📝");
          }
          return NextResponse.json({ ok: true });
        }
      }

      await sendTelegram(chatId, reply);
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json({ ok: true });
  }
}

export async function GET() {
  return NextResponse.json({ status: "Jarvis is running! 🤖" });
}
