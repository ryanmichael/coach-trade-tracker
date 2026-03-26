export default function LoginPage() {
  return (
    <div
      className="flex h-screen items-center justify-center"
      style={{ backgroundColor: "var(--bg-base)" }}
    >
      <div className="surface-card w-full max-w-sm">
        <h1
          className="text-xl font-medium"
          style={{ color: "var(--text-primary)" }}
        >
          Coach Trade Tracker
        </h1>
        <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          Enter your PIN to continue
        </p>
        {/* TODO: implement PIN auth form */}
      </div>
    </div>
  );
}
