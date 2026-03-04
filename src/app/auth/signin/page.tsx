"use client";

import { signIn } from "next-auth/react";
import { useEffect } from "react";

const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export default function SignInPage() {
  useEffect(() => {
    if (DEMO_MODE) {
      signIn("demo", { callbackUrl: "/" });
    } else {
      signIn("azure-ad", { callbackUrl: "/" });
    }
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-gray-500">Redirecting to sign in...</p>
    </div>
  );
}
