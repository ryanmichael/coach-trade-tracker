"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Invite {
  id: string;
  email: string;
  invitedAt: string;
  acceptedAt: string | null;
}

export default function AdminPage() {
  const router = useRouter();
  const [invites, setInvites] = useState<Invite[]>([]);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadInvites() {
    const res = await fetch("/api/admin/invites");
    if (res.status === 403) {
      router.push("/options-finder");
      return;
    }
    const data = await res.json();
    setInvites(data.invites ?? []);
  }

  useEffect(() => {
    loadInvites();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.toLowerCase().trim();
    if (!trimmed) return;

    setLoading(true);
    setError(null);

    const res = await fetch("/api/admin/invites", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: trimmed }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error ?? "Failed to invite");
      setLoading(false);
      return;
    }

    setEmail("");
    setLoading(false);
    await loadInvites();
  }

  async function handleRevoke(id: string) {
    await fetch(`/api/admin/invites/${id}`, { method: "DELETE" });
    await loadInvites();
  }

  const font = "var(--font-dm-sans), system-ui, sans-serif";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        padding: "32px 16px",
      }}
    >
      <div style={{ maxWidth: 520, margin: "0 auto" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            marginBottom: 32,
          }}
        >
          <button
            onClick={() => router.push("/options-finder")}
            style={{
              fontFamily: font,
              fontSize: 13,
              color: "var(--text-secondary)",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
            }}
          >
            ← Back
          </button>
          <h1
            style={{
              fontFamily: font,
              fontSize: 18,
              fontWeight: 500,
              color: "var(--text-primary)",
              margin: 0,
            }}
          >
            Manage Invites
          </h1>
        </div>

        {/* Invite form */}
        <form
          onSubmit={handleInvite}
          style={{ display: "flex", gap: 8, marginBottom: 24 }}
        >
          <input
            type="email"
            required
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError(null);
            }}
            placeholder="user@example.com"
            style={{
              flex: 1,
              fontFamily: font,
              fontSize: 14,
              color: "var(--text-primary)",
              background: "var(--bg-input)",
              border: "1px solid var(--border-strong)",
              borderRadius: 8,
              padding: "10px 12px",
              outline: "none",
            }}
            onFocus={(e) =>
              (e.currentTarget.style.borderColor = "var(--border-focus)")
            }
            onBlur={(e) =>
              (e.currentTarget.style.borderColor = "var(--border-strong)")
            }
          />
          <button
            type="submit"
            disabled={loading || !email.trim()}
            style={{
              fontFamily: font,
              fontSize: 14,
              fontWeight: 500,
              color: "white",
              background: "var(--accent-primary)",
              border: "none",
              borderRadius: 8,
              padding: "10px 16px",
              cursor: loading ? "not-allowed" : "pointer",
              opacity: loading ? 0.5 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {loading ? "Sending..." : "Send Invite"}
          </button>
        </form>

        {error && (
          <p
            style={{
              fontFamily: font,
              fontSize: 13,
              color: "var(--semantic-negative)",
              margin: "-16px 0 16px 0",
            }}
          >
            {error}
          </p>
        )}

        {/* Invite list */}
        {invites.length === 0 ? (
          <p
            style={{
              fontFamily: font,
              fontSize: 14,
              color: "var(--text-tertiary)",
            }}
          >
            No invites yet.
          </p>
        ) : (
          <div
            style={{
              border: "1px solid var(--border-default)",
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            {invites.map((invite, i) => (
              <div
                key={invite.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 16px",
                  background: "var(--bg-surface)",
                  borderTop:
                    i > 0 ? "1px solid var(--border-default)" : "none",
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: font,
                      fontSize: 14,
                      color: "var(--text-primary)",
                    }}
                  >
                    {invite.email}
                  </div>
                  <div
                    style={{
                      fontFamily: font,
                      fontSize: 12,
                      color: "var(--text-tertiary)",
                      marginTop: 2,
                    }}
                  >
                    Invited{" "}
                    {new Date(invite.invitedAt).toLocaleDateString()}
                    {invite.acceptedAt && (
                      <>
                        {" · "}
                        <span style={{ color: "var(--semantic-positive)" }}>
                          Accepted{" "}
                          {new Date(invite.acceptedAt).toLocaleDateString()}
                        </span>
                      </>
                    )}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {invite.acceptedAt ? (
                    <span
                      style={{
                        fontFamily: font,
                        fontSize: 12,
                        fontWeight: 500,
                        color: "var(--semantic-positive)",
                        background: "var(--semantic-positive-muted)",
                        padding: "3px 8px",
                        borderRadius: 6,
                      }}
                    >
                      Active
                    </span>
                  ) : (
                    <>
                      <span
                        style={{
                          fontFamily: font,
                          fontSize: 12,
                          fontWeight: 500,
                          color: "var(--semantic-warning)",
                          background: "var(--semantic-warning-muted)",
                          padding: "3px 8px",
                          borderRadius: 6,
                        }}
                      >
                        Pending
                      </span>
                      <button
                        onClick={() => handleRevoke(invite.id)}
                        style={{
                          fontFamily: font,
                          fontSize: 12,
                          color: "var(--semantic-negative)",
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          padding: "3px 6px",
                        }}
                      >
                        Revoke
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
