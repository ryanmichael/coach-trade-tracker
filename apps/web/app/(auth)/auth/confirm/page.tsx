"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

function ConfirmFlow() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function confirm() {
      const tokenHash = searchParams.get("token_hash");
      const type = searchParams.get("type");

      if (!tokenHash || !type) {
        setError("Invalid confirmation link.");
        return;
      }

      const supabase = createClient();
      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "magiclink" | "email",
      });

      if (verifyError) {
        console.error("OTP verification failed:", verifyError);
        setError(verifyError.message);
        return;
      }

      // Ensure User record exists in our DB
      try {
        await fetch("/api/auth/on-login", { method: "POST" });
      } catch {
        // Non-critical
      }

      router.replace("/options-finder");
    }

    confirm();
  }, [searchParams, router]);

  if (error) {
    return (
      <div style={{ textAlign: "center" }}>
        <p style={{ fontSize: 14, color: "var(--semantic-negative)", marginBottom: 12 }}>
          {error}
        </p>
        <a
          href="/login"
          style={{ fontSize: 13, color: "var(--accent-primary)" }}
        >
          Back to login
        </a>
      </div>
    );
  }

  return (
    <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
      Verifying your login...
    </p>
  );
}

export default function AuthConfirmPage() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-base)",
        fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
        color: "var(--text-primary)",
      }}
    >
      <Suspense
        fallback={
          <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
            Loading...
          </p>
        }
      >
        <ConfirmFlow />
      </Suspense>
    </div>
  );
}
