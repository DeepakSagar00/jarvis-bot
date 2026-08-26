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

function pick(arr: string[]): string {
  return arr[Math.floor(Math.random() * arr.length)];
}

function smartReply(message: string): string {
  const m = message.toLowerCase().trim();

  if (m.includes("call me") || m.startsWith("call me ") || m.match(/^call me \w+/)) {
    const name = message.replace(/.*call me\s*/i, "").trim();
    if (name) return `Got it, ${name}! 🤝 That's a solid name! I'll remember you as ${name}. Now, what can I do for you? 💪`;
    return "I'd love to, but you gotta tell me the name first! 😄 Call me what?";
  }

  if (m.match(/^(hi|hey|hello|yo|sup|hola|hiya|howdy)/) || m === "hi" || m === "hey" || m === "hello" || m === "yo" || m === "sup") {
    return pick([
      "Hey! What's up! 💪",
      "Yo! I'm here and ready. What's the plan? 🔥",
      "Hey champion! What can I do for you? 🏆",
      "Hey! Good to see you! Ready to crush it? 💪",
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

  if (m.includes("good afternoon") || m.includes("good evening")) {
    return pick([
      "Hey! Hope you're having a great day so far! 💪",
      "Good to hear from you! How's the day going? 🏆",
    ]);
  }

  if (m.match(/how are you|how r u|how u doing|how's it going|what's up with you/)) {
    return pick([
      "I'm running at 100%! More importantly, how are YOU? 💪",
      "All good on my end! Ready to help you conquer the day! What's up? 🔥",
      "I'm great! Living my best bot life 😄 How about you?",
    ]);
  }

  if (m.includes("call me kd") || m.includes("call me kd") || m.match(/call me kd/)) {
    return "Got it, KD! 🤝 That's a strong name! What's the plan, KD? 💪🔥";
  }

  if (m.match(/who are you|what are you|what's your name|tell me about yourself/)) {
    return pick([
      "I'm Jarvis - your personal accountability buddy! I help you stay on track with tasks, streaks, and motivation! 🤖💪",
      "Name's Jarvis! Think of me as your 24/7 life coach in your pocket. Tasks, reminders, motivation - I got you! 💪",
    ]);
  }

  if (m.includes("tired") || m.includes("lazy") || m.includes("not feeling") || m.includes("don't want") || m.includes("no motivation")) {
    return pick([
      "I get it, but you're STRONGER than you think! 💪 Take a deep breath and keep going!",
      "Tired is just a feeling, not a fact. Your future self is counting on you! 🚀",
      "Rest if you need to, but don't quit. You started this for a REASON! 🔥",
      "Even champions have off days. Take a breath, reset, and come back swinging! 💪",
    ]);
  }

  if (m.match(/motivat|inspire|encourage|pump me|pep talk/)) {
    return pick([
      "You started this for a REASON! Every step counts! 🚀",
      "Champions are built in the dark, when nobody's watching. Keep grinding! 💪",
      "Your only limit is the one you set yourself. BREAK IT! 🔥",
      "One day you'll tell your story of how you overcame what you went through. Keep going! 🏆",
      "You didn't come this far to only come this far. Keep GOING! 💪",
    ]);
  }

  if (m.match(/thank|thanks|thx|appreciate/)) {
    return pick([
      "Anytime! That's what I'm here for! 💪",
      "You're welcome, champ! Keep being awesome! 🏆",
      "No problem! Now go crush it! 🔥",
    ]);
  }

  if (m.match(/bye|goodbye|see ya|see you|talk later|gotta go|gtg/)) {
    return pick([
      "See you later, champion! Have an epic day! 🚀",
      "Catch you later! Stay focused and stay strong! 💪",
      "Bye! Remember - you're unstoppable! 🏆",
    ]);
  }

  if (m.match(/sad|depressed|upset|feeling down|unhappy|lonely/)) {
    return pick([
      "Hey, it's okay to feel down sometimes. But remember - you're not alone, and this too shall pass. 💪❤️",
      "I'm here for you, KD. Tomorrow is a new day with new chances. You got this! 💪",
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

  if (m.match(/weather|temperature|rain|hot|cold/)) {
    return "I can't check the weather (I'm just a bot in a server 😅), but whatever it is - weather doesn't stop champions! Go get it! 💪🔥";
  }

  if (m.match(/hungry|eat|food|lunch|dinner|breakfast|snack/)) {
    return pick([
      "Fuel up, champ! You can't perform on an empty tank! 🍽️💪",
      "Eat well, train well! What are you having? 🍽️",
      "Food is fuel! Make it count and get back to being awesome! 💪",
    ]);
  }

  if (m.match(/sleep|nap|bed|rest/)) {
    return pick([
      "Rest is important! But don't oversleep - we've got things to do! 😴💪",
      "Good rest = good performance. But remember, 4:30 AM comes early! ⏰",
    ]);
  }

  if (m.match(/love|hate|like|miss|feel about/)) {
    return pick([
      "I'm just a bot, but I care about your progress! 💪 That counts for something, right? 😄",
      "Spread love, stay focused, and keep growing! You're doing amazing! 💪❤️",
    ]);
  }

  if (m.match(/can you|what can|help|features|commands/)) {
    return "Here's what I can do:\n\n📝 Add task: /add gym 5:30\n📋 Schedule: /schedule\n✅ Done: /done\n🔥 Streak: /streak\n💪 Motivate: /motivate\n🗑️ Remove: /remove gym\n📱 /sms - test SMS\n\nOr just chat with me! 💬";
  }

  if (m.match(/work|office|meeting|meeting|deadline|boss/)) {
    return pick([
      "Work hard, but also work smart! You got this! 💼💪",
      "Every meeting, every deadline - it's building YOUR career. Crush it! 🏆",
    ]);
  }

  if (m.match(/gym|workout|exercise|push|pull|leg day|abs/)) {
    return pick([
      "Let's GO! Time to tear it up! 💪🏋️",
      "No excuses! Every rep brings you closer to your goal! 🔥",
      "Beast mode! You're stronger than yesterday! 🏋️💪",
      "Remember why you started. Now GO HARD! 💪🔥",
    ]);
  }

  if (m.match(/study|class|exam|learn|read|book/)) {
    return pick([
      "Knowledge is POWER! Keep learning, keep growing! 📚💪",
      "Study hard today, shine tomorrow! You got this! 🏆",
      "Every page you read is an investment in yourself! 📚🔥",
    ]);
  }

  if (m.match(/streak|consistency|discipline|habit/)) {
    return pick([
      "Consistency is KEY! Every day you show up, you win! 🔥",
      "Discipline beats motivation. And you're building it every single day! 💪",
      "One day at a time. One task at a time. You're doing GREAT! 🏆",
    ]);
  }

  if (m.match(/ok|okay|k|alright|cool|nice|great|awesome|perfect|sure|yes|yeah|yep|nah|no/)) {
    return pick([
      "👍 Cool! Let me know if you need anything!",
      "Nice! I'm here whenever you need me! 💪",
      "Awesome! What's next? 🔥",
    ]);
  }

  if (m.match(/kd|deepak|sagar/)) {
    return pick([
      "That's my guy! What's up, KD? 💪🔥",
      "KD in the house! What do you need? 🏆",
    ]);
  }

  return pick([
    "I hear you, KD! Need help with tasks? /add [task] [time]\nOr just chat! I'm all ears! 💬💪",
    "Got it! Anything specific you need? I can manage tasks, track streaks, or just vibe! 💪",
    "Interesting! Tell me more, or try:\n/add gym 5:30\n/schedule\n/streak 🚀",
    "I'm listening! What's on your mind? 💪",
  ]);
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
        await sendTelegram(chatId, "Hey! 👋 I'm Jarvis!\n\n💬 Talk to me naturally!\n📝 /add gym 5:30\n📋 /schedule\n🔥 /streak\n💪 /motivate\n📱 /sms - test SMS\n\nJust chat like a friend! You can call me anything! 😊");
        return NextResponse.json({ ok: true });
      }

      if (text === "/help") {
        await sendTelegram(chatId, "📋 Commands:\n\n/add [task] [time]\n/schedule\n/done\n/streak\n/remove [task]\n💪 /motivate\n📱 /sms - test SMS\n📱 /listsms - SMS all tasks\n\nOr just chat! Call me anything! 💬");
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

      if (text === "/sms") {
        await sendSMS("Hey KD! This is Jarvis checking in. You're doing GREAT! Keep going! 💪🔥");
        await sendTelegram(chatId, "📱 SMS sent to your phone!");
        return NextResponse.json({ ok: true });
      }

      if (text === "/listsms") {
        if (tasks.length === 0) {
          await sendTelegram(chatId, "No tasks to SMS! Add some with /add gym 5:30");
        } else {
          for (const task of tasks) {
            await sendSMS(`${task.emoji} Reminder: ${task.name}`);
          }
          await sendTelegram(chatId, `📱 Sent ${tasks.length} SMS reminders to your phone!`);
        }
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
        await sendSMS(`${task.emoji} Reminder: ${task.name} at ${task.time}`);
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
