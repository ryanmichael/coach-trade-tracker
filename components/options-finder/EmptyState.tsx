"use client";

export function EmptyState({
  message,
  sub,
}: {
  message?: string;
  sub?: string;
}) {
  return (
    <div style={{ textAlign: "center", padding: "60px 20px" }}>
      <div
        style={{
          fontSize: 14,
          color: "var(--text-secondary)",
          marginBottom: 8,
        }}
      >
        {message ?? "No contracts match filters"}
      </div>
      <div style={{ fontSize: 12, color: "var(--text-tertiary)" }}>
        {sub ?? "Try adjusting expiry range or OI thresholds"}
      </div>
    </div>
  );
}
