"use client";

import { OptionsFinder } from "@/components/options-finder/OptionsFinder";

export default function OptionsFinderPage() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--bg-base)",
        overflowY: "auto",
      }}
    >
      <OptionsFinder />
    </div>
  );
}
