import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Coachtrack",
  description: "Day trading recommendation dashboard",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100dvh",
        backgroundColor: "var(--bg-base)",
      }}
    >
      {children}
    </div>
  );
}
