"use client";

import { SessionProvider, signIn, useSession } from "next-auth/react";
import type { Session } from "next-auth";
import { useEffect } from "react";

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

function DemoAutoSignIn({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  useEffect(() => {
    if (DEMO_MODE && status === "unauthenticated") {
      signIn("demo", { redirect: false }).then((res) => {
        if (res?.ok) window.location.reload();
      });
    }
  }, [status]);

  return <>{children}</>;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider session={DEMO_MODE ? demoSession : undefined}>
      <DemoAutoSignIn>{children}</DemoAutoSignIn>
    </SessionProvider>
  );
}
