export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
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
  if (n.includes("meditat") || n.includes("yoga")) return "🧘";
  return "⚡";
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
  } catch (e) {
    console.error("SMS failed:", e);
  }
}

function smartReply(message: string): string {
  const m = message.toLowerCase().trim();

  const greetings = [
    "Hey buddy! 💪 Ready to crush today?",
    "What's up, champion! 🏆",
    "Hey! Good to see you! What's the plan? 🔥",
    "Yo! I'm here and ready. What do you need? 💪",
  ];

  const tired = [
    "I get it, but you're STRONGER than you think! 💪 Take a deep breath and keep going!",
    "Tired is just a feeling, not a fact. Your future self is counting on you! 🚀",
    "Rest if you need to, but don't quit. You started this for a REASON! 🔥",
  ];

  const motivation = [
    "You started this journey for a REASON! Every rep, every early morning - it's building YOUR success! 🚀",
    "Champions aren't made in comfort zones. You're here, you're fighting. That's what matters! 💪",
    "The pain of discipline is nothing compared to the pain of regret. Keep PUSHING! 🔥",
    "You didn't come this far to only come this far. Keep GOING! 🏆",
    "Small steps every day. That's how you change your life. You're doing GREAT! ⭐",
  ];

  const thanks = [
    "Anytime, buddy! That's what I'm here for! 💪",
    "You're welcome, champ! Keep being awesome! 🏆",
  ];

  const bye = [
    "See you later, champion! Have an epic day! 🚀",
    "Catch you later! Stay focused and stay strong! 💪",
  ];

  if (m.includes("hi") || m.includes("hey") || m.includes("hello") || m === "yo" || m === "sup") {
    return greetings[Math.floor(Math.random() * greetings.length)];
  }
  if (m.includes("tired") || m.includes("lazy") || m.includes("not feeling") || m.includes("don't want")) {
    return tired[Math.floor(Math.random() * tired.length)];
  }
  if (m.includes("motivate") || m.includes("inspire") || m.includes("encourage") || m.includes("pump")) {
    return motivation[Math.floor(Math.random() * motivation.length)];
  }
  if (m.includes("thank") || m.includes("thanks") || m.includes("thx")) {
    return thanks[Math.floor(Math.random() * thanks.length)];
  }
  if (m.includes("bye") || m.includes("good night") || m.includes("gn") || m.includes("see you")) {
    return bye[Math.floor(Math.random() * bye.length)];
  }
  if (m.includes("how are you") || m.includes("how r u") || m.includes("what's up")) {
    return "I'm doing great, buddy! More importantly, how are YOU? Ready to dominate today? 💪🔥";
  }
  if (m.includes("good morning") || m.includes("gm")) {
    return "Good morning, CHAMPION! ☀️ Rise and grind! Today is YOUR day! 🏆";
  }
  if (m.includes("good night") || m.includes("gn")) {
    return "Good night, king! 👑 Rest well. Tomorrow we go HARDER! 💪";
  }
  if (m.includes("who are you") || m.includes("what are you")) {
    return "I'm Jarvis, your personal accountability buddy! I help you manage tasks, track streaks, and stay motivated! 🤖💪";
  }
  if (m.includes("sad") || m.includes("depressed") || m.includes("upset")) {
    return "Hey, it's okay to feel down sometimes. But remember - you're not alone, and this too shall pass. You're doing better than you think! 💪❤️";
  }
  if (m.includes("can you") || m.includes("what can")) {
    return "I can:\n📝 Add tasks: /add gym 5:30\n📋 View schedule: /schedule\n🔥 Track streaks: /streak\n💪 Motivate you anytime!\n\nJust talk to me! 💬";
  }

  return "Hey! I hear you! 💪 I'm here to help with tasks and motivation. Try:\n/add gym 5:30\n/schedule\n/streak\n\nOr just chat with me! 😊";
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
    theme: "hype",
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
  let msg = `🔥 Current: ${streak.currentStreak} days\n🏆 Best: ${streak.longestStreak} days\n✅ Total: ${streak.totalCompleted} tasks`;
  if (streak.currentStreak >= 7) msg += "\n\n🌟 INCREDIBLE! 7+ days straight!";
  if (streak.currentStreak >= 30) msg += "\n\n🏆 LEGENDARY! 30+ days!";
  return msg;
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";
      if (!text) return NextResponse.json({ ok: true });

      process.env.USER_CHAT_ID = String(chatId);

      if (text === "/start") {
        await sendTelegram(chatId, "Hey! 👋 I'm Jarvis!\n\n💬 Talk to me naturally!\n📝 /add gym 5:30\n📋 /schedule\n🔥 /streak\n💪 /motivate\n\nJust chat like a friend!");
        return NextResponse.json({ ok: true });
      }

      if (text === "/help") {
        await sendTelegram(chatId, "📋 Commands:\n\n/add [task] [time]\n/schedule\n/done\n/streak\n/remove [task]\n\nOr just chat! 💬");
        return NextResponse.json({ ok: true });
      }

      if (text === "/schedule") {
        const today = tasks.filter((t) => t.date === getTodayDate());
        const tomorrow = tasks.filter((t) => t.date === getTomorrowDate());
        let msg = "📋 Schedule:\n\n";
        if (today.length) msg += "Today:\n" + today.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n") + "\n\n";
        if (tomorrow.length) msg += "Tomorrow:\n" + tomorrow.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n");
        if (!today.length && !tomorrow.length) msg = "No tasks! /add gym 5:30 📝";
        await sendTelegram(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      if (text === "/done") {
        updateStreak(true);
        const reply = "✅ Task completed!\n\n" + getStreakMessage();
        await sendTelegram(chatId, reply);
        return NextResponse.json({ ok: true });
      }

      if (text === "/streak") {
        await sendTelegram(chatId, getStreakMessage());
        return NextResponse.json({ ok: true });
      }

      if (text === "/motivate") {
        const msgs = [
          "You started this for a REASON! Every step counts! 🚀",
          "Champions are built in the dark, when nobody's watching. Keep grinding! 💪",
          "Your only limit is the one you set yourself. BREAK IT! 🔥",
          "One day you'll tell your story of how you overcame what you went through. Keep going! 🏆",
        ];
        await sendTelegram(chatId, msgs[Math.floor(Math.random() * msgs.length)]);
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
          tasks.splice(tasks.indexOf(found), 1);
          await sendTelegram(chatId, `${found.emoji} ${found.name} removed! ✅`);
        } else {
          await sendTelegram(chatId, `Can't find "${name}". Check /schedule`);
        }
        return NextResponse.json({ ok: true });
      }

      const reply = smartReply(text);
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
