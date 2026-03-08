"use client";

import { SessionProvider } from "next-auth/react";
import type { Session } from "next-auth";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const demoSession: Session = {
  user: {
    name: "Demo User",
    email: "demo@example.com",
  } as Session["user"] & { upn: string; role: string; groups: string[] },
  expires: "2099-12-31T23:59:59.999Z",
};

// Attach extra fields after creation to avoid TS strict literal check
Object.assign(demoSession.user!, { upn: "demo@example.com", role: "admin", groups: [] });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={DEMO_MODE ? demoSession : undefined}>
      {children}
    </SessionProvider>
  );
}
