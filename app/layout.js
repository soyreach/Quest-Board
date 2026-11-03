import { Red_Hat_Display, Red_Hat_Text } from "next/font/google";
import { getServerSession } from "next-auth";
import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";
import { authOptions } from "@/lib/auth";
import { THEME_SCRIPT } from "@/lib/theme";

// One family in two optical cuts: Display for headings, Text (wider spacing,
// sturdier strokes) for everything read at small sizes.
const display = Red_Hat_Display({ subsets: ["latin"], variable: "--font-display" });
const text = Red_Hat_Text({ subsets: ["latin"], variable: "--font-text" });

export const metadata = {
  title: "Quest Board",
  description: "Turn theoretical classwork into CV-ready credentials.",
};

export default async function RootLayout({ children }) {
  // Handing the session down means the nav knows who's signed in on first paint,
  // instead of showing "Sign in" until a request to /api/auth/session comes back.
  const session = await getServerSession(authOptions);

  return (
    // The theme script sets data-theme before React hydrates, hence the warning opt-out.
    <html lang="en" className={`${display.variable} ${text.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>
        <Providers session={session}>
          <a href="#main" className="skip-link">Skip to content</a>
          <Nav />
          <main id="main" className="pt-24">{children}</main>
          <footer className="border-t border-[color:var(--line)] py-10 text-center text-xs text-ink/60">
            Quest Board — a closed-loop project board for AUPP coursework.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
