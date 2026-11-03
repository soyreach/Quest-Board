"use client";

import { SessionProvider } from "next-auth/react";
import PageTransitions from "@/components/PageTransitions";
import ScrollReveal from "@/components/ScrollReveal";

export default function Providers({ session, children }) {
  return (
    <SessionProvider session={session}>
      <PageTransitions />
      <ScrollReveal />
      {children}
    </SessionProvider>
  );
}
