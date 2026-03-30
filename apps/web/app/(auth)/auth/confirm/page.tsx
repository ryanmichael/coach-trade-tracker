"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * /auth/confirm
 * Handles PKCE magic link verification.
 * Supabase emails link here with token_hash + type params.
 * We verify the OTP client-side (using the stored PKCE code_verifier),
 * then call on-login and redirect to /options-finder.
 */
export default function AuthConfirmPage() {
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
      {error ? (
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
      ) : (
        <p style={{ fontSize: 14, color: "var(--text-secondary)" }}>
          Verifying your login...
        </p>
      )}
    </div>
  );
}
