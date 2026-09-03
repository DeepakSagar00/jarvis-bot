import { kv } from "@vercel/kv";

export interface Task {
  id: string;
  name: string;
  emoji: string;
  time: string;
  date: string;
  reminded: boolean;
}

export interface UserData {
  tasks: Task[];
  streak: number;
  longestStreak: number;
  lastCompletedDate: string | null;
  totalCompleted: number;
  nickname: string;
}

const DEFAULT_USER: Omit<UserData, "tasks"> = {
  streak: 0,
  longestStreak: 0,
  lastCompletedDate: null,
  totalCompleted: 0,
  nickname: "",
};

function userKey(chatId: number): string {
  return `user:${chatId}`;
}

export async function getUserData(chatId: number): Promise<UserData> {
  try {
    const data = await kv.get<UserData>(userKey(chatId));
    if (data) return data;
    return { tasks: [], ...DEFAULT_USER };
  } catch (e) {
    console.error("KV get failed:", e);
    return { tasks: [], ...DEFAULT_USER };
  }
}

export async function saveUserData(chatId: number, data: UserData): Promise<void> {
  try {
    await kv.set(userKey(chatId), data);
  } catch (e) {
    console.error("KV save failed:", e);
  }
}

export async function getAllUsers(): Promise<Array<{ chatId: number; data: UserData }>> {
  try {
    const keys = await kv.keys("user:*");
    const users: Array<{ chatId: number; data: UserData }> = [];
    for (const key of keys) {
      const chatId = parseInt(key.replace("user:", ""));
      const data = await kv.get<UserData>(key);
      if (data) users.push({ chatId, data });
    }
    return users;
  } catch (e) {
    console.error("KV list failed:", e);
    return [];
  }
}
