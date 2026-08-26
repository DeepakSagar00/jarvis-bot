import type { Metadata } from "next";
export const metadata: Metadata = { title: "Jarvis Bot", description: "Your AI assistant" };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body>{children}</body></html>);
}
