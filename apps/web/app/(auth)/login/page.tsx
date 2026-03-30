"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type LoginState = "idle" | "submitting" | "sent" | "uninvited" | "error";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<LoginState>("idle");
  const [errorDetail, setErrorDetail] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.toLowerCase().trim();
    if (!trimmed) return;

    setState("submitting");
    setErrorDetail(null);

    try {
      // Check invite first
      const checkRes = await fetch("/api/auth/check-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!checkRes.ok) {
        setErrorDetail(`Invite check failed: ${checkRes.status}`);
        setState("error");
        return;
      }

      const checkData = await checkRes.json();

      if (!checkData.invited) {
        setState("uninvited");
        return;
      }

      // Send magic link
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: trimmed,
        options: {
          emailRedirectTo: `${window.location.origin}/api/auth/callback`,
        },
      });

      if (error) {
        console.error("Magic link error:", error);
        setErrorDetail(`Supabase: ${error.message}`);
        setState("error");
        return;
      }

      setState("sent");
    } catch (err) {
      setErrorDetail(String(err));
      setState("error");
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--bg-base)",
        padding: 16,
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 380,
          background: "var(--bg-surface)",
          border: "1px solid var(--border-default)",
          borderRadius: 8,
          padding: 32,
        }}
      >
        {/* Logo */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
            marginBottom: 8,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 7,
              background: "var(--accent-primary)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M3 13L13 3M3 13C5 11 7 9.5 9 9M3 13C5 12 8 11.5 11 12"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <circle cx="12" cy="4" r="1.5" fill="white" />
            </svg>
          </div>
          <span
            style={{
              fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
              fontSize: 15,
              fontWeight: 600,
              color: "var(--text-primary)",
            }}
          >
            Coachtrack
          </span>
        </div>

        <p
          style={{
            fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
            fontSize: 12,
            color: "var(--text-tertiary)",
            margin: "0 0 24px 0",
          }}
        >
          Options Finder
        </p>

        {state === "sent" ? (
          <div>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 14,
                color: "var(--text-primary)",
                margin: "0 0 8px 0",
              }}
            >
              Check your email
            </p>
            <p
              style={{
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 13,
                color: "var(--text-secondary)",
                margin: 0,
                lineHeight: 1.5,
              }}
            >
              We sent a login link to{" "}
              <span style={{ color: "var(--text-primary)" }}>{email}</span>.
              It expires in 1 hour.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label
              htmlFor="email"
              style={{
                display: "block",
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                color: "var(--text-secondary)",
                marginBottom: 6,
              }}
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (state === "uninvited" || state === "error") setState("idle");
              }}
              placeholder="you@example.com"
              style={{
                width: "100%",
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 14,
                color: "var(--text-primary)",
                background: "var(--bg-input)",
                border: "1px solid var(--border-strong)",
                borderRadius: 8,
                padding: "10px 12px",
                outline: "none",
                boxSizing: "border-box",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-focus)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--border-strong)")
              }
            />

            {state === "uninvited" && (
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                  fontSize: 13,
                  color: "var(--semantic-warning)",
                  margin: "8px 0 0 0",
                }}
              >
                You don't have access yet. Contact the admin.
              </p>
            )}

            {state === "error" && (
              <p
                style={{
                  fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                  fontSize: 13,
                  color: "var(--semantic-negative)",
                  margin: "8px 0 0 0",
                }}
              >
                Something went wrong. Try again.
                {errorDetail && (
                  <span
                    style={{
                      display: "block",
                      fontSize: 11,
                      color: "var(--text-tertiary)",
                      marginTop: 4,
                    }}
                  >
                    {errorDetail}
                  </span>
                )}
              </p>
            )}

            <button
              type="submit"
              disabled={state === "submitting" || !email.trim()}
              style={{
                width: "100%",
                marginTop: 16,
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 14,
                fontWeight: 500,
                color: "white",
                background: "var(--accent-primary)",
                border: "none",
                borderRadius: 8,
                padding: "10px 0",
                cursor:
                  state === "submitting" || !email.trim()
                    ? "not-allowed"
                    : "pointer",
                opacity: state === "submitting" || !email.trim() ? 0.5 : 1,
                transition: "opacity 120ms",
              }}
            >
              {state === "submitting" ? "Sending..." : "Send magic link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
