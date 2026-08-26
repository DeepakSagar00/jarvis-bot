export default function Home() {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100vh", fontFamily: "sans-serif" }}>
      <h1>🤖 Jarvis Bot</h1>
      <p>Your AI assistant is running!</p>
      <a href="https://t.me/jarvis_move_one_bot" style={{ marginTop: 20, padding: "10px 20px", background: "#0088cc", color: "white", borderRadius: 8, textDecoration: "none" }}>
        Open Telegram Bot
      </a>
    </div>
  );
}
