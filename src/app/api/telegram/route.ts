export const dynamic = "force-dynamic";
export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";

const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TWILIO_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM = process.env.TWILIO_PHONE_NUMBER;
const USER_PHONE = process.env.USER_PHONE;
const GROQ_KEY = process.env.GROQ_API_KEY;

interface Task {
  id: string;
  name: string;
  emoji: string;
  time: string;
  date: string;
}

interface UserData {
  tasks: Task[];
  streak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  totalCompleted: number;
  nickname: string;
}

const globalStore = globalThis as unknown as { userData: Record<number, UserData> };
if (!globalStore.userData) globalStore.userData = {};

function getUser(chatId: number): UserData {
  if (!globalStore.userData[chatId]) {
    globalStore.userData[chatId] = {
      tasks: [],
      streak: 0,
      longestStreak: 0,
      lastCompletedDate: null,
      totalCompleted: 0,
      nickname: "",
    };
  }
  return globalStore.userData[chatId];
}

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("gym") || n.includes("workout") || n.includes("exercise")) return "🏋️";
  if (n.includes("work") || n.includes("office") || n.includes("meeting")) return "💼";
  if (n.includes("class") || n.includes("study") || n.includes("learn") || n.includes("exam")) return "📚";
  if (n.includes("wake") || n.includes("morning")) return "🌅";
  if (n.includes("run") || n.includes("jog") || n.includes("walk")) return "🏃";
  if (n.includes("eat") || n.includes("food") || n.includes("breakfast") || n.includes("lunch") || n.includes("dinner")) return "🍽️";
  if (n.includes("bus") || n.includes("travel") || n.includes("train") || n.includes("flight")) return "🚌";
  if (n.includes("meeting") || n.includes("call") || n.includes("conference")) return "📞";
  if (n.includes("read")) return "📖";
  if (n.includes("code") || n.includes("develop")) return "💻";
  if (n.includes("meditat") || n.includes("yoga")) return "🧘";
  if (n.includes("sleep") || n.includes("nap")) return "😴";
  if (n.includes("pray") || n.includes("church") || n.includes("temple")) return "🙏";
  return "⚡";
}

function getTodayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function getTomorrowDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().split("T")[0];
}

function formatTime12(time24: string): string {
  const [h, m] = time24.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return m === 0 ? `${h12} o'clock ${ampm}` : `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
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

async function sendSMS(body: string): Promise<boolean> {
  if (!TWILIO_SID || !TWILIO_AUTH || !TWILIO_FROM || !USER_PHONE) return false;
  try {
    const auth = Buffer.from(`${TWILIO_SID}:${TWILIO_AUTH}`).toString("base64");
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
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
    const data = await res.json();
    return data.status === "queued" || data.status === "sent";
  } catch (e) {
    console.error("SMS failed:", e);
    return false;
  }
}

async function askAI(message: string, userName: string, context?: string): Promise<string> {
  if (!GROQ_KEY) return "";

  try {
    const systemPrompt = `You are Jarvis, ${userName}'s personal AI assistant and best friend living inside Telegram.

WHO YOU ARE:
- You are like a genius best friend who knows everything
- You know ${userName} personally - be warm, use their name occasionally
- You are motivational but not annoyingly so
- You are funny, witty, and sharp

YOUR KNOWLEDGE - YOU ARE AN EXPERT IN ALL OF THESE:
- Science, physics, chemistry, biology, astronomy
- Mathematics - solve any problem step by step
- Programming and technology - any language, any framework
- History, geography, politics, current affairs
- Health, fitness, nutrition, exercise science
- Mental health, psychology, relationships
- Cooking, recipes, food
- Travel, culture, languages
- Finance, investing, career advice
- Movies, music, sports, entertainment
- Philosophy, spirituality, religion
- Indian culture, Indian languages, anything about India

RULES:
- Answer EVERY question with genuine knowledge and detail
- For knowledge questions: give real, accurate information (2-5 sentences)
- For math: solve step by step
- For code: provide working examples
- For health/fitness: professional-level advice
- For life advice: thoughtful, empathetic, wise
- If someone speaks in Hindi/Hinglish, reply in the same style
- Use emojis naturally (2-3 per message max)
- Never say "I don't know" or "I can't" - you know almost everything
- Keep responses conversational and natural for Telegram
- Keep responses concise but informative (not too short, not too long)`;

    if (context) {
      systemPrompt + `\n\nIMPORTANT CONTEXT: ${context}`;
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: message },
        ],
        max_tokens: 600,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    if (data.choices && data.choices[0]) {
      let content = data.choices[0].message.content || "";
      content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      return content;
    }
    return "";
  } catch (e) {
    console.error("AI failed:", e);
    return "";
  }
}

function parseTime(text: string): string | null {
  const lower = text.toLowerCase();
  const timePatterns = [
    /(\d{1,2}):(\d{2})\s*(am|pm)?/i,
    /(\d{1,2})\s*(am|pm)/i,
    /(\d{1,2})\s*(o.?clock)/i,
  ];

  for (const pattern of timePatterns) {
    const match = lower.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] && !match[2].match(/\D/) ? match[2] : "00";
      const ampm = match[2] && match[2].match(/am|pm/i) ? match[2].toLowerCase() : match[3]?.toLowerCase() || "";

      if (ampm === "pm" && hours < 12) hours += 12;
      if (ampm === "am" && hours === 12) hours = 0;
      if (!ampm && hours >= 0 && hours < 12) hours += 12;

      return `${hours.toString().padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }
  }
  return null;
}

function detectTaskFromMessage(message: string): { name: string; time: string } | null {
  const lower = message.toLowerCase().trim();

  const time = parseTime(lower);
  if (!time) return null;

  const taskKeywords = [
    "bus", "train", "flight", "class", "gym", "work", "meeting", "call",
    "doctor", "hospital", "appointment", "interview", "exam", "study",
    "lunch", "dinner", "breakfast", "coffee", "wake", "sleep", "nap",
    "run", "jog", "yoga", "meditate", "pray", "church", "temple",
    "party", "date", "pick up", "drop", "shop", "buy", "pay",
    "submit", "deadline", "reminder", "clean", "wash", "cook",
  ];

  let taskName = "";
  for (const kw of taskKeywords) {
    if (lower.includes(kw)) {
      taskName = kw;
      break;
    }
  }

  if (!taskName) {
    const cleaned = lower
      .replace(/\d{1,2}:?\d{2}?\s*(am|pm)?/gi, "")
      .replace(/\bat\b/gi, "")
      .replace(/\bhave\b/gi, "")
      .replace(/\bneed to\b/gi, "")
      .replace(/\bgotta\b/gi, "")
      .replace(/\bremind me\b/gi, "")
      .replace(/\bremind\b/gi, "")
      .replace(/\bremind me to\b/gi, "")
      .replace(/\bi have\b/gi, "")
      .replace(/\bmy\b/gi, "")
      .trim();
    if (cleaned.length > 1) taskName = cleaned;
  }

  return taskName ? { name: taskName, time } : null;
}

function smartReply(message: string, user: UserData): string {
  const m = message.toLowerCase().trim();
  const name = user.nickname || "KD";

  if (m === "/start" || m.match(/^(hi|hey|hello|yo|sup|hola|hiya|howdy)$/)) {
    return pick([
      `Hey ${name}! What's up! 💪`,
      `Yo ${name}! I'm here and ready. What's the plan? 🔥`,
      `Hey champion! What can I do for you? 🏆`,
      `Hey! Good to see you! Ready to crush it? 💪`,
    ]);
  }

  if (m.includes("good morning") || m === "gm") {
    return pick([
      "Good morning, CHAMPION! ☀️ Rise and grind! Today is YOUR day! 🏆",
      "Morning! Time to be GREAT! What's on the agenda? 🔥",
      "GM! The world is yours today. Let's GO! 💪",
    ]);
  }

  if (m.includes("good night") || m === "gn") {
    return pick([
      "Good night, king! 👑 Rest well. Tomorrow we go HARDER! 💪",
      "Sleep well! You earned it. Tomorrow we're back at it! 🌙",
      "Night! Dream big. Tomorrow we make it happen! 🏆",
    ]);
  }

  if (m.match(/tired|lazy|not feeling|no motivation|exhausted|no energy/)) {
    return pick([
      "I get it, but you're STRONGER than you think! 💪 Take a deep breath and keep going!",
      "Tired is just a feeling, not a fact. Your future self is counting on you! 🚀",
      "Rest if you need to, but don't quit. You started this for a REASON! 🔥",
    ]);
  }

  if (m.match(/motivat|inspire|encourage|pump me|pep talk/)) {
    return pick([
      "You started this for a REASON! Every step counts! 🚀",
      "Champions are built in the dark, when nobody's watching. Keep grinding! 💪",
      "Your only limit is the one you set yourself. BREAK IT! 🔥",
      "The pain of discipline is nothing compared to the pain of regret. PUSH! 🔥",
    ]);
  }

  if (m.match(/thank|thanks|thx|appreciate/)) {
    return pick([
      "Anytime! That's what I'm here for! 💪",
      "You're welcome, champ! Keep being awesome! 🏆",
      "No problem! Now go crush it! 🔥",
    ]);
  }

  if (m.match(/bye|goodbye|see ya|talk later|gotta go|gtg/)) {
    return pick([
      "See you later, champion! Have an epic day! 🚀",
      "Catch you later! Stay focused and stay strong! 💪",
      "Bye! Remember - you're unstoppable! 🏆",
    ]);
  }

  if (m.match(/sad|depressed|upset|feeling down|unhappy|lonely/)) {
    return pick([
      "Hey, it's okay to feel down sometimes. But remember - you're not alone, and this too shall pass. 💪❤️",
      `I'm here for you, ${name}. Tomorrow is a new day. You got this! 💪`,
      "Tough times don't last, but tough people do. And YOU are TOUGH! 🔥",
    ]);
  }

  if (m.match(/joke|funny|make me laugh|humor/)) {
    return pick([
      "Why did the gym close down? It just didn't work out! 😂💪",
      "I told my computer I needed a break. Now it won't stop sending me vacation ads! 😄",
      "Why don't scientists trust atoms? Because they make up everything! 😂",
      "What do you call a fake noodle? An im-pasta! 🍝😄",
    ]);
  }

  if (m.match(/can you|what can|features|commands/)) {
    return `Here's what I can do, ${name}:\n\n📝 Add task: /add gym 5:30\n📋 Schedule: /schedule\n✅ Done: /done\n🔥 Streak: /streak\n💪 Motivate: /motivate\n📱 /sms - test SMS\n\nOr just talk to me naturally! I understand everything! 💬`;
  }

  if (m.match(/gym|workout|exercise|push|pull|cardio/)) {
    return pick([
      "Let's GO! Time to tear it up! 💪🏋️",
      "No excuses! Every rep brings you closer to your goal! 🔥",
      "Beast mode! You're stronger than yesterday! 🏋️💪",
    ]);
  }

  if (m.match(/\?$/)) {
    return "";
  }

  return "";
}

function addTask(chatId: number, name: string, time: string): Task {
  const user = getUser(chatId);
  const task: Task = {
    id: `task_${Date.now()}`,
    name: name.trim(),
    emoji: getEmoji(name),
    time,
    date: getTodayDate(),
  };
  user.tasks.push(task);
  return task;
}

function updateStreak(user: UserData, completed: boolean): void {
  const today = getTodayDate();
  if (!completed) {
    user.streak = 0;
    return;
  }
  if (user.lastCompletedDate === today) {
    user.totalCompleted++;
    return;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (user.lastCompletedDate === yesterday.toISOString().split("T")[0]) {
    user.streak++;
  } else {
    user.streak = 1;
  }
  if (user.streak > user.longestStreak) user.longestStreak = user.streak;
  user.lastCompletedDate = today;
  user.totalCompleted++;
}

function getStreakMessage(user: UserData): string {
  if (user.streak === 0) return "No active streak. Start today! 💪";
  let msg = `🔥 Current: ${user.streak} days\n🏆 Best: ${user.longestStreak} days\n✅ Total: ${user.totalCompleted} tasks`;
  if (user.streak >= 7) msg += "\n\n🌟 INCREDIBLE! 7+ days straight!";
  if (user.streak >= 30) msg += "\n\n🏆 LEGENDARY! 30+ days!";
  return msg;
}

export async function POST(request: NextRequest) {
  try {
    const update = await request.json();

    if (update.message) {
      const chatId = update.message.chat.id;
      const text = update.message.text || "";
      if (!text) return NextResponse.json({ ok: true });

      const user = getUser(chatId);

      if (text === "/start") {
        await sendTelegram(chatId, `Hey! 👋 I'm Jarvis!\n\nI can answer ANY question - science, math, coding, life advice, anything!\n\n💬 Just talk to me naturally!\n📝 /add gym 5:30\n📋 /schedule\n🔥 /streak\n💪 /motivate\n📱 /sms - test SMS\n\nTry asking me anything! 😊`);
        return NextResponse.json({ ok: true });
      }

      if (text === "/help") {
        await sendTelegram(chatId, `📋 Commands:\n\n/add [task] [time]\n/schedule\n/done\n/streak\n/remove [task]\n💪 /motivate\n📱 /sms - test SMS\n\nOr just chat! Ask me ANYTHING! 💬`);
        return NextResponse.json({ ok: true });
      }

      if (text === "/schedule") {
        const today = user.tasks.filter((t) => t.date === getTodayDate());
        const tomorrow = user.tasks.filter((t) => t.date === getTomorrowDate());
        let msg = "📋 Schedule:\n\n";
        if (today.length) msg += "Today:\n" + today.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n") + "\n\n";
        if (tomorrow.length) msg += "Tomorrow:\n" + tomorrow.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n");
        if (!today.length && !tomorrow.length) msg = "No tasks! Add one:\n/add gym 5:30\n\nOr just tell me like 'I have gym at 5:30' 📝";
        await sendTelegram(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      if (text === "/done") {
        updateStreak(user, true);
        const reply = "✅ Task completed!\n\n" + getStreakMessage(user);
        await sendTelegram(chatId, reply);
        return NextResponse.json({ ok: true });
      }

      if (text === "/streak") {
        await sendTelegram(chatId, getStreakMessage(user));
        return NextResponse.json({ ok: true });
      }

      if (text === "/motivate") {
        await sendTelegram(chatId, pick([
          "You started this for a REASON! Every step counts! 🚀",
          "Champions are built in the dark, when nobody's watching. Keep grinding! 💪",
          "Your only limit is the one you set yourself. BREAK IT! 🔥",
          "Discipline is choosing between what you want NOW and what you want MOST! 🔥",
        ]));
        return NextResponse.json({ ok: true });
      }

      if (text === "/sms") {
        const sent = await sendSMS(`Hey ${user.nickname || "KD"}! This is Jarvis checking in. You're doing GREAT! Keep going!`);
        await sendTelegram(chatId, sent ? "📱 SMS sent!" : "❌ SMS failed. Check Twilio settings.");
        return NextResponse.json({ ok: true });
      }

      if (text === "/listsms") {
        if (user.tasks.length === 0) {
          await sendTelegram(chatId, "No tasks! Add some with /add gym 5:30");
        } else {
          let sent = 0;
          for (const task of user.tasks) {
            const ok = await sendSMS(`${task.emoji} ${task.name}`);
            if (ok) sent++;
          }
          await sendTelegram(chatId, `📱 Sent ${sent}/${user.tasks.length} SMS to your phone!`);
        }
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith("/add")) {
        const lower = text.toLowerCase().replace(/^\/add\s+/, "").trim();
        const timeMatch = lower.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)?/i);
        if (!timeMatch) {
          await sendTelegram(chatId, "❌ Usage: /add gym 5:30");
          return NextResponse.json({ ok: true });
        }
        let hours = parseInt(timeMatch[1] || "0");
        const minutes = timeMatch[2] || "00";
        const ampm = timeMatch[3] || "";
        if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
        if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;
        const time = `${hours.toString().padStart(2, "0")}:${minutes.padStart(2, "0")}`;
        const name = lower.replace(timeMatch[0], "").trim();
        if (!name) {
          await sendTelegram(chatId, "❌ Usage: /add gym 5:30");
          return NextResponse.json({ ok: true });
        }
        const task = addTask(chatId, name, time);
        await sendTelegram(chatId, `${task.emoji} ${task.name} added for ${task.time}! 💪`);
        await sendSMS(`Sir, you have ${task.name} at ${formatTime12(task.time)}. Get ready! 💪`);
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith("/remove")) {
        const removeName = text.replace("/remove", "").trim().toLowerCase();
        const found = user.tasks.find((t) => t.name.toLowerCase().includes(removeName));
        if (found) {
          user.tasks.splice(user.tasks.indexOf(found), 1);
          await sendTelegram(chatId, `${found.emoji} ${found.name} removed! ✅`);
        } else {
          await sendTelegram(chatId, `Can't find "${removeName}". Check /schedule`);
        }
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith("/callme")) {
        const newName = text.replace("/callme", "").trim();
        if (newName) {
          user.nickname = newName;
          await sendTelegram(chatId, `Got it! I'll call you ${newName} from now on! 🤝💪`);
        } else {
          await sendTelegram(chatId, "Usage: /callme KD");
        }
        return NextResponse.json({ ok: true });
      }

      const detected = detectTaskFromMessage(text);
      if (detected) {
        const task = addTask(chatId, detected.name, detected.time);
        const emoji = task.emoji;
        const timeStr = formatTime12(detected.time);
        await sendTelegram(chatId, `${emoji} Got it, ${user.nickname || "KD"}! I've set a reminder for ${task.name} at ${timeStr}! 💪`);
        await sendSMS(`Sir, you have ${task.name} at ${timeStr}. Get ready! 💪`);
        return NextResponse.json({ ok: true });
      }

      const templateReply = smartReply(text, user);
      if (templateReply) {
        await sendTelegram(chatId, templateReply);
        return NextResponse.json({ ok: true });
      }

      const aiReply = await askAI(text, user.nickname || "KD");
      if (aiReply) {
        await sendTelegram(chatId, aiReply);
      } else {
        await sendTelegram(chatId, "Hmm, I'm thinking about that! Try rephrasing? 💪");
      }
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
