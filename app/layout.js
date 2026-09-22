import "./globals.css";
import Providers from "./providers";
import Nav from "@/components/Nav";

export const metadata = {
  title: "Quest Board",
  description: "Turn theoretical classwork into CV-ready credentials.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Nav />
          <main className="pt-24">{children}</main>
          <footer className="border-t border-black/5 py-10 text-center text-xs text-[var(--ink)]/40">
            Quest Board — a closed-loop project board for AUPP coursework.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
