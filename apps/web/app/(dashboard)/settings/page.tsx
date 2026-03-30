export default function SettingsPage() {
  return (
    <div className="p-8">
      <h1
        className="text-2xl font-medium"
        style={{ color: "var(--text-primary)", letterSpacing: "-0.02em" }}
      >
        Settings
      </h1>
      <p className="mt-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        Configure alerts, API keys, and preferences
      </p>
    </div>
  );
}
