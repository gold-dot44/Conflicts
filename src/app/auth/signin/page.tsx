"use client";

import { getProviders, signIn, useSession } from "next-auth/react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function SignInPage() {
  const { status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/");
      return;
    }
    if (status === "loading") return;

    getProviders().then((providers) => {
      if (!providers) return;
      if (providers.demo) {
        signIn("demo", { redirect: false }).then((res) => {
          if (res?.ok) router.replace("/");
        });
      } else if (providers["azure-ad"]) {
        signIn("azure-ad", { callbackUrl: "/" });
      }
    });
  }, [status, router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh]">
      <p className="text-gray-500">Signing in...</p>
    </div>
  );
}
