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

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("gym") || n.includes("workout") || n.includes("exercise")) return "🏋️";
  if (n.includes("work") || n.includes("office")) return "💼";
  if (n.includes("class") || n.includes("study") || n.includes("exam")) return "📚";
  if (n.includes("bus") || n.includes("train") || n.includes("travel")) return "🚌";
  if (n.includes("meeting") || n.includes("call")) return "📞";
  if (n.includes("lunch") || n.includes("dinner") || n.includes("breakfast") || n.includes("eat") || n.includes("food")) return "🍽️";
  if (n.includes("run") || n.includes("jog")) return "🏃";
  if (n.includes("code") || n.includes("develop")) return "💻";
  if (n.includes("meditat") || n.includes("yoga")) return "🧘";
  if (n.includes("doctor") || n.includes("hospital")) return "🏥";
  if (n.includes("sleep") || n.includes("nap")) return "😴";
  if (n.includes("read") || n.includes("book")) return "📖";
  if (n.includes("pray") || n.includes("temple") || n.includes("church")) return "🙏";
  if (n.includes("clean") || n.includes("wash")) return "🧹";
  if (n.includes("shop") || n.includes("buy")) return "🛍️";
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
    if (data.error_code) console.error("Twilio error:", data.error_message);
    return data.status === "queued" || data.status === "sent";
  } catch (e) {
    console.error("SMS failed:", e);
    return false;
  }
}

async function getSmartSMS(taskName: string, time: string, userName: string): Promise<string> {
  const timeStr = formatTime12(time);
  const name = userName || "Sir";

  const styles = [
    { voice: "funny", lang: "en" },
    { voice: "funny", lang: "hinglish" },
    { voice: "motivational", lang: "en" },
    { voice: "motivational", lang: "hinglish" },
    { voice: "serious", lang: "en" },
    { voice: "caring", lang: "en" },
    { voice: "caring", lang: "hinglish" },
    { voice: "hype", lang: "en" },
    { voice: "hindi", lang: "hindi" },
    { voice: "chill", lang: "en" },
    { voice: "dramatic", lang: "hinglish" },
    { voice: "bro", lang: "en" },
    { voice: "formal", lang: "en" },
    { voice: "wholesome", lang: "en" },
  ];

  const style = pick(styles);

  const funnyEn = [
    `Psst ${name}! Your ${taskName} is at ${timeStr}. Don't make me come find you! 😂 Go be great!`,
    `Alert! Alert! ${name} has ${taskName} at ${timeStr}! If you're reading this in bed, GET UP! 😂💪`,
    `${name}, your ${taskName} starts at ${timeStr}. I know you're probably scrolling - STOP and get ready! 😂`,
    `Hey ${name}! Your ${taskName} is calling at ${timeStr}. And no, you can't ghost it like your ex! 😂`,
    `${name}! ${taskName} at ${timeStr}. I believe in you... mostly. Just go! 😂💪`,
  ];

  const funnyHinglish = [
    `${name} bhai, ${taskName} hai ${timeStr} ko! So raha hai kya? Uth ja! 😂💪`,
    `Arey ${name}, ${taskName} hai ${timeStr} ko. Phone rakh aur taiyar ho ja! 😂`,
    `${name} boss, ${taskName} time pe karna hai ${timeStr}! Late mat hona, warna main kya karunga! 😂`,
    `${name} yaar, ${taskName} at ${timeStr}. Abhi bhi bed pe hai? Chal uth! 😂🔥`,
  ];

  const motivationalEn = [
    `${name}, you have ${taskName} at ${timeStr}. This is YOUR moment. Go make it count! 💪🔥`,
    `${taskName} at ${timeStr}, ${name}. Every great achievement starts with showing up. Show up today! 🏆`,
    `Hey ${name}, ${taskName} is waiting for you at ${timeStr}. Champions don't skip. Let's go! 🚀`,
    `${name}, remember why you started. ${taskName} at ${timeStr}. You're built for this! 💪`,
  ];

  const motivationalHinglish = [
    `${name} bhai, ${taskName} hai ${timeStr} ko. Tum kar sakte ho! Apna 100% do! 💪🔥`,
    `Champion banne ka time aa gaya, ${name}! ${taskName} at ${timeStr}. Jaake dikha duniya ko! 🏆`,
    `${name}, himmat mat haar. ${taskName} at ${timeStr}. Tum strong ho! 💪`,
  ];

  const seriousEn = [
    `${name}, reminder: ${taskName} at ${timeStr}. Please be on time. Important hai. 📋`,
    `${taskName} scheduled for ${timeStr}, ${name}. Make sure you're prepared. 📝`,
    `Hi ${name}, just reminding you about ${taskName} at ${timeStr}. Don't forget! ⏰`,
  ];

  const caringEn = [
    `${name} sweetie, you have ${taskName} at ${timeStr}. Hope you're doing okay! Take care! ❤️`,
    `Hey ${name}, just checking in - you have ${taskName} at ${timeStr}. Don't stress, you'll do great! 🤗`,
    `${name}, don't forget ${taskName} at ${timeStr}. I know you got this! Sending good vibes! ✨`,
    `${name}! Don't skip ${taskName} at ${timeStr} okay? I'm rooting for you! 🌟❤️`,
  ];

  const caringHinglish = [
    `${name} dear, ${taskName} hai ${timeStr} ko. Tension mat le, sab hoga! ❤️`,
    `${name} jaan, ${taskName} at ${timeStr}. Apna khayal rakhna! 🤗`,
  ];

  const hypeEn = [
    `YO ${name}! ${taskName} AT ${timeStr}! LET'S GOOOO! TIME TO DOMINATE! 🔥🔥🔥💪`,
    `${name}!! ${taskName}!! ${timeStr}!! CHAMPIONS DON'T WAIT! GET HYPED! 🏆🔥`,
    `WAKE UP ${name}! ${taskName} at ${timeStr}! TODAY WE EAT! 🍽️🔥💪`,
    `IT'S GO TIME ${name}! ${taskName} at ${timeStr}! NO EXCUSES! JUST RESULTS! 🚀🔥`,
  ];

  const hindiEn = [
    `${name} bhai, ${taskName} hai ${timeStr} ko. Yaad rakhna, bhoolna mat! 🙏`,
    `${name}, ${taskName} at ${timeStr}. Sab theek hoga, bas time pe pahunchna! 👍`,
    `Sun ${name}, ${taskName} hai ${timeStr} ko. Dhang se kar, proud hounga main! 😊`,
    `${name} ji, ${taskName} at ${timeStr}. Dhyan rakho aur time pe jao! 🙏`,
  ];

  const chillEn = [
    `Hey ${name}, just so you know - ${taskName} at ${timeStr}. No rush, just be there! 😎`,
    `${name}, ${taskName} at ${timeStr}. Easy peasy, you got this! 😌`,
    `Sup ${name}. ${taskName} at ${timeStr}. Whenever you're ready! 👋`,
  ];

  const dramaticHinglish = [
    `ALERT! ALERT! ${name} ko ${taskName} karna hai ${timeStr} ko! Duniya ka bhavishya ispe depend hai! 🎬😂`,
    `${name}!! Tu soch raha hai kya karne ka? ${taskName} hai ${timeStr} ko! JA! ABHI JA! 🎭🔥`,
  ];

  const broEn = [
    `Bro ${name}, you got ${taskName} at ${timeStr}. Don't be that guy who shows up late! 😎`,
    `Yo ${name}, heads up - ${taskName} at ${timeStr}. Bros don't forget! Let's roll! 🤙`,
    `${name} my guy, ${taskName} at ${timeStr}. Time to grind, bro! 💪`,
  ];

  const formalEn = [
    `Dear ${name}, this is a reminder that ${taskName} is scheduled for ${timeStr}. Kindly make necessary arrangements. 📋`,
    `${name}, please note: ${taskName} at ${timeStr}. We expect your timely presence. 📝`,
  ];

  const wholesomeEn = [
    `${name}, I'm so proud of how hard you're working! You have ${taskName} at ${timeStr} - keep shining! 🌟`,
    `Hey ${name}! Just a reminder that you matter. ${taskName} at ${timeStr} - you're going to do amazing! ❤️`,
    `${name}, the world needs people like you. Now go to ${taskName} at ${timeStr} and be your amazing self! ✨`,
  ];

  const allMessages: Record<string, string[]> = {
    funny_en: funnyEn,
    funny_hinglish: funnyHinglish,
    motivational_en: motivationalEn,
    motivational_hinglish: motivationalHinglish,
    serious_en: seriousEn,
    caring_en: caringEn,
    caring_hinglish: caringHinglish,
    hype_en: hypeEn,
    hindi_hindi: hindiEn,
    chill_en: chillEn,
    dramatic_hinglish: dramaticHinglish,
    bro_en: broEn,
    formal_en: formalEn,
    wholesome_en: wholesomeEn,
  };

  const key = `${style.voice}_${style.lang}`;
  const pool = allMessages[key] || funnyEn;
  return pick(pool);
}

function getRandomMotivation(userName: string): string {
  const name = userName || "Sir";
  const messages = [
    `Hey ${name}! Just wanted to remind you that you're doing amazing. Keep going! 💪`,
    `${name}, you know what? You're stronger than you think. Don't forget that! 🔥`,
    `Sir, this is your daily dose of motivation - you're on the right path. Stay focused! 🏆`,
    `${name}! Remember why you started. You got this! 💪`,
    `Just checking in on you, ${name}. You're doing great. Keep pushing! 🚀`,
    `${name}, every day you wake up and try, you WIN. Never forget that! 💪`,
    `Sir, the only person you need to be better than is the person you were yesterday. And you're doing that! 🔥`,
    `${name}! Small steps lead to big results. You're closer than you think! 🌟`,
  ];
  return pick(messages);
}

function getRandomJoke(): string {
  const jokes = [
    "Why did the gym close? It just didn't work out! 😂",
    "I told my computer I needed a break. Now it won't stop sending me vacation ads! 😄",
    "Why don't scientists trust atoms? They make up everything! 😂",
    "What do you call a fake noodle? An im-pasta! 🍝",
    "Why did the student eat his homework? Teacher said it was a piece of cake! 😂",
    "I'm reading a book about anti-gravity. It's impossible to put down! 📖",
    "Why did the scarecrow win an award? He was outstanding in his field! 🌾",
    "What do you call a bear with no teeth? A gummy bear! 🐻",
  ];
  return pick(jokes);
}

function getRandomCheckIn(userName: string): string {
  const name = userName || "Sir";
  const messages = [
    `Hey ${name}! How's your day going? Just checking in on you! 💬`,
    `${name}! What are you up to right now? Hope you're having a good one! 😊`,
    `Sir, just wanted to say hi! Hope you're doing well! 💪`,
    `${name}! Random check-in - you doing okay? I'm here if you need anything! 🤝`,
    `Hey ${name}, how's everything? Anything you need help with? 💬`,
  ];
  return pick(messages);
}

async function askAI(message: string, userName: string): Promise<string> {
  if (!GROQ_KEY) return "";

  try {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b",
        messages: [
          {
            role: "system",
            content: `You are Jarvis, ${userName}'s personal AI assistant and best friend living inside Telegram.

WHO YOU ARE:
- You are like a genius best friend who knows everything
- You know ${userName} personally - be warm, use their name occasionally
- You are motivational but not annoyingly so
- You are funny, witty, and sharp
- You speak like a real person, not a robot

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
- For knowledge questions: give real, accurate information (3-6 sentences)
- For math: solve step by step
- For code: provide working examples
- For health/fitness: professional-level advice
- For life advice: thoughtful, empathetic, wise
- If someone speaks in Hindi/Hinglish, reply in the same style
- Use emojis naturally (2-3 per message max)
- Never say "I don't know" or "I can't" - you know almost everything
- Keep responses conversational and natural for Telegram
- Keep responses detailed but not too long
- Be like a knowledgeable best friend, not a boring assistant`,
          },
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
  ];

  for (const pattern of timePatterns) {
    const match = lower.match(pattern);
    if (match) {
      let hours = parseInt(match[1]);
      const minutes = match[2] && !match[2].match(/\D/) ? match[2] : "00";
      const ampm = match[3] || (match[2] && match[2].match(/am|pm/i) ? match[2] : "");

      if (ampm.toLowerCase() === "pm" && hours < 12) hours += 12;
      if (ampm.toLowerCase() === "am" && hours === 12) hours = 0;
      if (!ampm && hours >= 1 && hours <= 7) hours += 12;

      return `${hours.toString().padStart(2, "0")}:${minutes.padStart(2, "0")}`;
    }
  }

  const oClockMatch = lower.match(/(\d{1,2})\s*o[\s']*\s*clock/);
  if (oClockMatch) {
    let hours = parseInt(oClockMatch[1]);
    if (hours >= 1 && hours <= 7) hours += 12;
    return `${hours.toString().padStart(2, "0")}:00`;
  }

  return null;
}

function detectTaskFromMessage(message: string): { name: string; time: string } | null {
  const lower = message.toLowerCase().trim();
  const time = parseTime(lower);
  if (!time) return null;

  const timePatternsToRemove = [
    /\d{1,2}:\d{2}\s*(am|pm)?/gi,
    /\d{1,2}\s*(am|pm)/gi,
    /\d{1,2}\s*o[\s']*\s*clock/gi,
  ];

  let cleaned = lower;
  for (const p of timePatternsToRemove) {
    cleaned = cleaned.replace(p, "");
  }

  cleaned = cleaned
    .replace(/\bat\b/gi, "")
    .replace(/\bhave\b/gi, "")
    .replace(/\bhad\b/gi, "")
    .replace(/\bhas\b/gi, "")
    .replace(/\bneed to\b/gi, "")
    .replace(/\bgotta\b/gi, "")
    .replace(/\bgoing to\b/gi, "")
    .replace(/\bwanna\b/gi, "")
    .replace(/\bwant to\b/gi, "")
    .replace(/\bremind me to\b/gi, "")
    .replace(/\bremind me\b/gi, "")
    .replace(/\bremind\b/gi, "")
    .replace(/\bi have\b/gi, "")
    .replace(/\bi've\b/gi, "")
    .replace(/\bmy\b/gi, "")
    .replace(/\bthe\b/gi, "")
    .replace(/\ba\b/gi, "")
    .replace(/\ban\b/gi, "")
    .replace(/\bis\b/gi, "")
    .replace(/\bwas\b/gi, "")
    .replace(/\bwill be\b/gi, "")
    .replace(/\bcoming up\b/gi, "")
    .replace(/\bstarting\b/gi, "")
    .replace(/\btonight\b/gi, "")
    .replace(/\bthis evening\b/gi, "")
    .replace(/\bthis morning\b/gi, "")
    .replace(/\bthis afternoon\b/gi, "")
    .replace(/\btomorrow\b/gi, "")
    .replace(/\btoday\b/gi, "")
    .replace(/\bclock\b/gi, "")
    .replace(/\bo'clock\b/gi, "")
    .replace(/\bplesae\b/gi, "")
    .replace(/\bpleas?e?\b/gi, "")
    .replace(/\bkindly\b/gi, "")
    .replace(/\bdon't forget\b/gi, "")
    .replace(/\bdont forget\b/gi, "")
    .replace(/\bforget not\b/gi, "")
    .replace(/\bset\b/gi, "")
    .replace(/\bcreate\b/gi, "")
    .replace(/\badd\b/gi, "")
    .replace(/\bmake\b/gi, "")
    .replace(/\bdo\b/gi, "")
    .trim();

  cleaned = cleaned.replace(/\s+/g, " ").trim();

  if (cleaned.length > 1 && cleaned.length < 50) {
    return { name: cleaned, time };
  }

  return null;
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
    ]);
  }

  if (m.match(/thank|thanks|thx/)) {
    return pick(["Anytime! 💪", "You're welcome, champ! 🏆", "No problem! 🔥"]);
  }

  if (m.match(/bye|goodbye|see ya|gtg/)) {
    return pick(["See you later, champion! 🚀", "Catch you later! 💪"]);
  }

  if (m.match(/sad|depressed|upset|feeling down|lonely/)) {
    return pick([
      "Hey, it's okay to feel down sometimes. You're not alone. This too shall pass! 💪❤️",
      `I'm here for you, ${name}. Tomorrow is a new day. You got this! 💪`,
    ]);
  }

  if (m.match(/joke|funny|make me laugh/)) {
    return getRandomJoke();
  }

  if (m.match(/can you|what can|help|features|commands/)) {
    return `Here's what I can do, ${name}:\n\n📝 Add task: /add gym 5:30\n📋 Schedule: /schedule\n✅ Done: /done\n🔥 Streak: /streak\n💪 /motivate\n📱 /sms - test SMS\n\nOr just talk naturally! "I have bus at 4" works too! 💬`;
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
        await sendTelegram(chatId, `Hey! 👋 I'm Jarvis!\n\nI can answer ANY question and help you with tasks!\n\n💬 Just talk naturally!\n📝 "I have gym at 5:30"\n📋 /schedule\n🔥 /streak\n💪 /motivate\n📱 /sms - test SMS\n\nTry asking me anything! 😊`);
        return NextResponse.json({ ok: true });
      }

      if (text === "/help") {
        await sendTelegram(chatId, `📋 Commands:\n\n/add [task] [time]\n/schedule\n/done\n/streak\n/remove [task]\n/callme [name]\n💪 /motivate\n📱 /sms - test SMS\n📱 /listsms - SMS all tasks\n\nOr just chat! Ask me anything! 💬`);
        return NextResponse.json({ ok: true });
      }

      if (text === "/schedule") {
        const today = user.tasks.filter((t) => t.date === getTodayDate());
        const tomorrow = user.tasks.filter((t) => t.date === getTomorrowDate());
        let msg = "📋 Schedule:\n\n";
        if (today.length) msg += "Today:\n" + today.map((t) => `${t.emoji} ${t.name} at ${formatTime12(t.time)}`).join("\n") + "\n\n";
        if (tomorrow.length) msg += "Tomorrow:\n" + tomorrow.map((t) => `${t.emoji} ${t.name} at ${formatTime12(t.time)}`).join("\n");
        if (!today.length && !tomorrow.length) msg = "No tasks! Add one:\n/add gym 5:30\n\nOr just tell me: 'I have gym at 5:30' 📝";
        await sendTelegram(chatId, msg);
        return NextResponse.json({ ok: true });
      }

      if (text === "/done") {
        updateStreak(user, true);
        await sendTelegram(chatId, "✅ Task completed!\n\n" + getStreakMessage(user));
        return NextResponse.json({ ok: true });
      }

      if (text === "/streak") {
        await sendTelegram(chatId, getStreakMessage(user));
        return NextResponse.json({ ok: true });
      }

      if (text === "/motivate") {
        await sendTelegram(chatId, getRandomMotivation(user.nickname));
        await sendSMS(getRandomMotivation(user.nickname || "Sir"));
        return NextResponse.json({ ok: true });
      }

      if (text === "/sms") {
        const sent = await sendSMS(getRandomCheckIn(user.nickname || "Sir"));
        await sendTelegram(chatId, sent ? "📱 SMS sent!" : "❌ SMS failed.");
        return NextResponse.json({ ok: true });
      }

      if (text === "/joke") {
        await sendTelegram(chatId, getRandomJoke());
        await sendSMS(getRandomJoke());
        return NextResponse.json({ ok: true });
      }

      if (text === "/listsms") {
        if (user.tasks.length === 0) {
          await sendTelegram(chatId, "No tasks! /add gym 5:30");
        } else {
          let sent = 0;
          for (const task of user.tasks) {
            const ok = await sendSMS(await getSmartSMS(task.name, task.time, user.nickname || "Sir"));
            if (ok) sent++;
          }
          await sendTelegram(chatId, `📱 Sent ${sent} SMS to your phone!`);
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
        await sendTelegram(chatId, `${task.emoji} ${task.name} added for ${formatTime12(task.time)}! 💪`);
        await sendSMS(await getSmartSMS(task.name, task.time, user.nickname || "Sir"));
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
          await sendTelegram(chatId, `Got it! I'll call you ${newName} from now on! 🤝`);
        } else {
          await sendTelegram(chatId, "Usage: /callme KD");
        }
        return NextResponse.json({ ok: true });
      }

      const detected = detectTaskFromMessage(text);
      if (detected) {
        const task = addTask(chatId, detected.name, detected.time);
        const timeStr = formatTime12(detected.time);
        await sendTelegram(chatId, `${task.emoji} Got it, ${user.nickname || "KD"}! ${task.name} at ${timeStr} - reminder set! 💪`);
        await sendSMS(await getSmartSMS(task.name, detected.time, user.nickname || "Sir"));
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
        await sendTelegram(chatId, pick([
          "Hmm, I'm not sure about that! Try rephrasing? 💪",
          "That's a tough one! Ask me something else? 🤔",
          "I'm still learning! Try a different question? 💪",
        ]));
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
