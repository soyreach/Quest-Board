"use client";

import { SessionProvider } from "next-auth/react";
import PageTransitions from "@/components/PageTransitions";

export default function Providers({ children }) {
  return (
    <SessionProvider>
      <PageTransitions />
      {children}
    </SessionProvider>
  );
}
