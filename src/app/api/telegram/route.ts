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

async function askAI(message: string, userName: string): Promise<string> {
  if (!GROQ_KEY) return "AI not configured! /help for commands. 💪";

  const shortCommands = ["/start", "/help", "/schedule", "/done", "/streak", "/motivate", "/sms", "/listsms"];
  const isCommand = shortCommands.some(c => message.startsWith(c)) || message.startsWith("/add") || message.startsWith("/remove");

  if (isCommand) return "";

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
            content: `You are Jarvis, ${userName}'s personal AI assistant living in Telegram. You are smart, friendly, helpful, and motivating - like a mix of ChatGPT and a best friend.

CORE RULES:
- Answer ANY question comprehensively - science, history, coding, math, health, life advice, cooking, travel, relationships, anything
- Be detailed when the question deserves it (2-5 sentences for knowledge questions), but concise for casual chat
- Use emojis naturally but don't overdo it
- Be warm and personal - you know ${userName}
- For math, give the answer directly
- For coding, explain clearly
- For health/fitness, be knowledgeable
- For life advice, be thoughtful and supportive
- Never say "I can't" - if you know the answer, give it
- Don't use markdown formatting, keep it as plain text for Telegram
- Match the language the user writes in (if they write in Hindi, reply in Hindi)`,
          },
          { role: "user", content: message },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    if (data.choices && data.choices[0]) {
      let content = data.choices[0].message.content || "";
      content = content.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
      if (content.length > 0) return content;
    }
    return "Hmm, I'm not sure! Try rephrasing or ask me something else! 💪";
  } catch (e) {
    console.error("AI failed:", e);
    return "AI temporarily busy! Try again in a sec 🧠";
  }
}

function getEmoji(name: string): string {
  const n = name.toLowerCase();
  if (n.includes("gym") || n.includes("workout") || n.includes("exercise")) return "🏋️";
  if (n.includes("work") || n.includes("office") || n.includes("meeting")) return "💼";
  if (n.includes("class") || n.includes("study") || n.includes("learn") || n.includes("exam")) return "📚";
  if (n.includes("wake") || n.includes("morning")) return "🌅";
  if (n.includes("run") || n.includes("jog") || n.includes("walk")) return "🏃";
  if (n.includes("eat") || n.includes("food") || n.includes("breakfast") || n.includes("lunch") || n.includes("dinner")) return "🍽️";
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

async function sendTelegram(chatId: number | string, text: string): Promise<void> {
  if (!TELEGRAM_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
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

function smartReply(message: string, user: UserData): string {
  const m = message.toLowerCase().trim();
  const name = user.nickname || "KD";

  if (m.match(/call me \w+/)) {
    const newName = message.replace(/.*call me\s*/i, "").trim();
    if (newName) {
      user.nickname = newName;
      return `Got it, ${newName}! 🤝 From now on I'll call you ${newName}! What can I do for you, ${newName}? 💪`;
    }
  }

  if (m === "/start" || m.match(/^(hi|hey|hello|yo|sup|hola|hiya|howdy)$/)) {
    return pick([
      `Hey ${name}! What's up! 💪`,
      `Yo ${name}! I'm here and ready. What's the plan? 🔥`,
      `Hey champion! What can I do for you? 🏆`,
      `Hey! Good to see you! Ready to crush it? 💪`,
      `${name}! My favorite person is back! What's the plan? 🔥`,
    ]);
  }

  if (m.includes("good morning") || m === "gm") {
    return pick([
      "Good morning, CHAMPION! ☀️ Rise and grind! Today is YOUR day! 🏆",
      "Morning! Time to be GREAT! What's on the agenda? 🔥",
      "GM! The world is yours today. Let's GO! 💪",
      "Rise and shine, king! Another day to be legendary! ☀️🏆",
    ]);
  }

  if (m.includes("good night") || m === "gn") {
    return pick([
      "Good night, king! 👑 Rest well. Tomorrow we go HARDER! 💪",
      "Sleep well! You earned it. Tomorrow we're back at it! 🌙",
      "Night! Dream big. Tomorrow we make it happen! 🏆",
      "GN! Sleep tight. Tomorrow is another chance to be GREAT! 🌙💪",
    ]);
  }

  if (m.includes("good afternoon") || m.includes("good eve")) {
    return pick([
      "Hey! Hope you're having a great day so far! 💪",
      "Good to hear from you! How's the day going? 🏆",
      `Afternoon ${name}! How's it going? 💪`,
    ]);
  }

  if (m.match(/how are you|how r u|how u doing|how.?s it going|what.?s up with you/)) {
    return pick([
      "I'm running at 100%! More importantly, how are YOU? 💪",
      "All good on my end! Ready to help you conquer the day! What's up? 🔥",
      "I'm great! Living my best bot life 😄 How about you?",
      "Couldn't be better! Now tell me about YOUR day! 💪",
    ]);
  }

  if (m.match(/who are you|what are you|what.?s your name|tell me about yourself/)) {
    return pick([
      "I'm Jarvis - your personal accountability buddy! I help you stay on track with tasks, streaks, and motivation! 🤖💪",
      "Name's Jarvis! Think of me as your 24/7 life coach in your pocket. Tasks, reminders, motivation - I got you! 💪",
      "I'm Jarvis! Your AI assistant built by you to help you CRUSH your goals! 🏆💪",
    ]);
  }

  if (m.match(/tired|lazy|not feeling|don.?t want|no motivation|exhausted|no energy|burnt out/)) {
    return pick([
      "I get it, but you're STRONGER than you think! 💪 Take a deep breath and keep going!",
      "Tired is just a feeling, not a fact. Your future self is counting on you! 🚀",
      "Rest if you need to, but don't quit. You started this for a REASON! 🔥",
      "Even champions have off days. Take a breath, reset, and come back swinging! 💪",
      "It's okay to rest. But don't stop. Small steps still move you forward! 🏆",
    ]);
  }

  if (m.match(/motivat|inspire|encourage|pump me|pep talk|boost/)) {
    return pick([
      "You started this for a REASON! Every step counts! 🚀",
      "Champions are built in the dark, when nobody's watching. Keep grinding! 💪",
      "Your only limit is the one you set yourself. BREAK IT! 🔥",
      "One day you'll tell your story of how you overcame what you went through. Keep going! 🏆",
      "You didn't come this far to only come this far. Keep GOING! 💪",
      "The pain of discipline is nothing compared to the pain of regret. PUSH HARDER! 🔥",
    ]);
  }

  if (m.match(/thank|thanks|thx|appreciate/)) {
    return pick([
      "Anytime! That's what I'm here for! 💪",
      "You're welcome, champ! Keep being awesome! 🏆",
      "No problem! Now go crush it! 🔥",
    ]);
  }

  if (m.match(/bye|goodbye|see ya|talk later|gotta go|gtg|cya/)) {
    return pick([
      "See you later, champion! Have an epic day! 🚀",
      "Catch you later! Stay focused and stay strong! 💪",
      "Bye! Remember - you're unstoppable! 🏆",
    ]);
  }

  if (m.match(/sad|depressed|upset|feeling down|unhappy|lonely|cry|crying|heartbreak/)) {
    return pick([
      "Hey, it's okay to feel down sometimes. But remember - you're not alone, and this too shall pass. 💪❤️",
      `I'm here for you, ${name}. Tomorrow is a new day with new chances. You got this! 💪`,
      "Tough times don't last, but tough people do. And YOU are TOUGH! 🔥",
      "I know it's hard right now. But you've gotten through tough times before, and you'll get through this too! 💪❤️",
    ]);
  }

  if (m.match(/joke|funny|make me laugh|humor|comedy|laugh/)) {
    return pick([
      "Why did the gym close down? It just didn't work out! 😂💪",
      "I told my computer I needed a break. Now it won't stop sending me vacation ads! 😄",
      "Why don't scientists trust atoms? Because they make up everything! 😂",
      "What do you call a fake noodle? An im-pasta! 🍝😄",
      "Why did the student eat his homework? Because his teacher told him it was a piece of cake! 😂",
      "What do you call a bear with no teeth? A gummy bear! 🐻😄",
    ]);
  }

  if (m.match(/weather|temperature|rain|hot|cold|sunshine/)) {
    return pick([
      "I can't check the weather, but whatever it is - weather doesn't stop champions! 💪🔥",
      "Rain or shine, you're showing up today! That's what matters! 💪",
    ]);
  }

  if (m.match(/hungry|eat|food|lunch|dinner|breakfast|snack|starving|thirsty|water/)) {
    return pick([
      "Fuel up, champ! You can't perform on an empty tank! 🍽️💪",
      "Eat well, train well! What are you having? 🍽️",
      "Food is fuel! Make it count and get back to being awesome! 💪",
      "Stay hydrated and eat clean! Your body is your machine! 💪💧",
    ]);
  }

  if (m.match(/sleep|nap|bed|rest|tired|exhausted/)) {
    return pick([
      "Rest is important! But don't oversleep - we've got things to do! 😴💪",
      "Good rest = good performance. Recharge and come back stronger! 🔋",
      "Sleep well, but remember your goals are waiting for you! 😴🏆",
    ]);
  }

  if (m.match(/\blove\b|\bhate\b|\blike\b|\bmiss\b/)) {
    return pick([
      "I'm just a bot, but I care about your progress! That counts for something, right? 😄💪",
      "Spread love, stay focused, and keep growing! You're doing amazing! 💪❤️",
    ]);
  }

  if (m.match(/can you|what can|features|commands/)) {
    return `Here's what I can do, ${name}:\n\n📝 Add task: /add gym 5:30\n📋 Schedule: /schedule\n✅ Done: /done\n🔥 Streak: /streak\n💪 Motivate: /motivate\n🗑️ Remove: /remove gym\n📱 /sms - test SMS\n📱 /listsms - SMS all tasks\n\nOr just chat with me! 💬`;
  }

  if (m.match(/work|office|meeting|deadline|boss|job|salary/)) {
    return pick([
      "Work hard, but also work smart! You got this! 💼💪",
      "Every meeting, every deadline - it's building YOUR career. Crush it! 🏆",
      "Work is temporary, but your growth is permanent. Keep leveling up! 💪",
    ]);
  }

  if (m.match(/gym|workout|exercise|push|pull|leg day|abs|cardio|bicep|chest/)) {
    return pick([
      "Let's GO! Time to tear it up! 💪🏋️",
      "No excuses! Every rep brings you closer to your goal! 🔥",
      "Beast mode! You're stronger than yesterday! 🏋️💪",
      "Remember why you started. Now GO HARD! 💪🔥",
      "Pain is temporary, pride is FOREVER! Go kill that workout! 🏆",
    ]);
  }

  if (m.match(/study|class|exam|learn|read|book| assignment|homework/)) {
    return pick([
      "Knowledge is POWER! Keep learning, keep growing! 📚💪",
      "Study hard today, shine tomorrow! You got this! 🏆",
      "Every page you read is an investment in yourself! 📚🔥",
      "You're investing in your future right now! Keep going! 📚💪",
    ]);
  }

  if (m.match(/streak|consistency|discipline|habit|routine/)) {
    return pick([
      "Consistency is KEY! Every day you show up, you win! 🔥",
      "Discipline beats motivation. And you're building it every single day! 💪",
      "One day at a time. One task at a time. You're doing GREAT! 🏆",
    ]);
  }

  if (m.match(/^ok$|^okay$|^k$|^alright$|^cool$|^nice$|^great$|^awesome$|^perfect$|^sure$|^yeah$|^yep$|^nah$|^no$|^y$/)) {
    return pick([
      "👍 Cool! Let me know if you need anything!",
      "Nice! I'm here whenever you need me! 💪",
      "Awesome! What's next? 🔥",
      "👍 Always here for you!",
    ]);
  }

  if (m.match(/car|bike|drive|travel|trip|vacation/)) {
    return pick([
      "Life's a journey! Enjoy the ride but stay focused on the destination! 🚗💪",
      "Travel goals! Work hard now, travel later! 🌍🏆",
    ]);
  }

  if (m.match(/money|rich|broke|expensive|cheap|buy|sell/)) {
    return pick([
      "Money follows value! Keep building your skills and the money will come! 💰💪",
      "Invest in yourself first! The returns are unlimited! 📈🏆",
    ]);
  }

  if (m.match(/girl|boy|crush|relationship|date|partner|gf|bf/)) {
    return pick([
      "Focus on yourself first! When you level up, everything else follows! 💪🏆",
      "Love yourself, work on yourself, and the right people will find you! ❤️💪",
    ]);
  }

  if (m.match(/phone|mobile|app|instagram|youtube|tiktok|social/)) {
    return pick([
      "Put the phone down and GO DO SOMETHING AMAZING! 📱➡️💪",
      "Social media is a trap! Your real life is out there! Go live it! 🔥",
    ]);
  }

  if (m.match(/age|old|young|born|birthday/)) {
    return pick([
      "Age is just a number! What matters is what you DO with your time! 💪",
      "You're never too old or too young to start! Just START! 🔥",
    ]);
  }

  if (m.match(/bored|boring|nothing to do|empty|idle/)) {
    return pick([
      "Bored? Perfect time to work on yourself! 💪 What task should we add?",
      "Boredom is a signal - it means you have time to GROW! Use it! 🔥",
      "Never bored when you have goals! What are you working on? 🏆",
    ]);
  }

  if (m.match(/help me|i need|please|assist/)) {
    return pick([
      `I'm here for you, ${name}! Tell me what you need! 💪`,
      "Of course! What's going on? I'm listening! 🤝",
    ]);
  }

  if (m.match(/yes|no|maybe|nah|yep|nope|true|false|correct|wrong/)) {
    return pick([
      "Got it! Anything else? 💪",
      "Noted! What's next? 🔥",
    ]);
  }

  if (m.match(/name|what should i|should i|should we|which|what do you think|opinion/)) {
    return pick([
      "Trust your gut! You usually know what's right! 💪",
      "I believe in whatever you choose! Just commit to it! 🔥",
      "You're the boss! I'm just here to support your decisions! 💪",
    ]);
  }

  if (m.match(/plan|schedule|today|tomorrow|week|agenda/)) {
    return "Use /schedule to see your tasks! Or /add to plan something new! 📝💪";
  }

  if (m.match(/\?$/)) {
    return pick([
      "Great question! I may not have all the answers, but I know you'll figure it out! 💪",
      "Hmm, I'm just a bot but I believe in you! 🤔💪",
      "That's deep! What I do know is you're capable of amazing things! 🔥",
    ]);
  }

  const randomResponses = [
    `Interesting, ${name}! Tell me more! 💬`,
    `I hear you, ${name}! What's on your mind? 💪`,
    `Got it! Need anything? Try /add gym 5:30 📝`,
    `${name}, I'm all ears! What's up? 🏆`,
    `Cool! Let me know how I can help! 💪`,
    `Noted! Anything you want to talk about? 💬`,
    `Sounds good, ${name}! Keep going! 🔥`,
    `I'm listening! What else is going on? 💪`,
  ];

  return pick(randomResponses);
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
        await sendTelegram(chatId, `Hey! 👋 I'm Jarvis!\n\n💬 Talk to me naturally!\n📝 /add gym 5:30\n📋 /schedule\n🔥 /streak\n💪 /motivate\n📱 /sms - test SMS\n\nJust chat like a friend! You can call me anything! 😊`);
        return NextResponse.json({ ok: true });
      }

      if (text === "/help") {
        await sendTelegram(chatId, `📋 Commands:\n\n/add [task] [time]\n/schedule\n/done\n/streak\n/remove [task]\n💪 /motivate\n📱 /sms - test SMS\n📱 /listsms - SMS all tasks\n\nOr just chat! Call me anything! 💬`);
        return NextResponse.json({ ok: true });
      }

      if (text === "/schedule") {
        const today = user.tasks.filter((t) => t.date === getTodayDate());
        const tomorrow = user.tasks.filter((t) => t.date === getTomorrowDate());
        let msg = "📋 Schedule:\n\n";
        if (today.length) msg += "Today:\n" + today.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n") + "\n\n";
        if (tomorrow.length) msg += "Tomorrow:\n" + tomorrow.map((t) => `${t.emoji} ${t.name} at ${t.time}`).join("\n");
        if (!today.length && !tomorrow.length) msg = "No tasks! /add gym 5:30 📝";
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
          "One day you'll tell your story of how you overcame what you went through. Keep going! 🏆",
          "Discipline is choosing between what you want NOW and what you want MOST! 🔥",
        ]));
        return NextResponse.json({ ok: true });
      }

      if (text === "/sms") {
        const smsResult = await sendSMS(`Hey ${user.nickname || 'KD'}! This is Jarvis checking in. You're doing GREAT! Keep going!`);
        await sendTelegram(chatId, "📱 SMS sent to your phone!");
        return NextResponse.json({ ok: true });
      }

      if (text === "/listsms") {
        if (user.tasks.length === 0) {
          await sendTelegram(chatId, "No tasks to SMS! Add some with /add gym 5:30");
        } else {
          for (const task of user.tasks) {
            await sendSMS(`${task.emoji} ${task.name}`);
          }
          await sendTelegram(chatId, `📱 Sent ${user.tasks.length} SMS reminders to your phone!`);
        }
        return NextResponse.json({ ok: true });
      }

      if (text.startsWith("/add")) {
        const parsed = parseAddCommand(text);
        if (!parsed) {
          await sendTelegram(chatId, "❌ Usage: /add gym 5:30");
          return NextResponse.json({ ok: true });
        }
        const task = addTask(chatId, parsed.name, parsed.time);
        await sendTelegram(chatId, `${task.emoji} ${task.name} added for ${task.time}! 💪`);
        await sendSMS(`${task.emoji} ${task.name}`);
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

      const reply = await askAI(text, user.nickname || "KD");
      if (reply) {
        await sendTelegram(chatId, reply);
      } else {
        const templateReply = smartReply(text, user);
        await sendTelegram(chatId, templateReply);
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
