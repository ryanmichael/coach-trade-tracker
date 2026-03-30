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
        height: "100dvh",
        overflow: "hidden",
        backgroundColor: "var(--bg-base)",
      }}
    >
      {children}
    </div>
  );
}
