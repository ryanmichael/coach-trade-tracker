"use client";
import { create } from "zustand";

interface UIStore {
  isQuickPasteOpen: boolean;
  openQuickPaste: () => void;
  closeQuickPaste: () => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isQuickPasteOpen: false,
  openQuickPaste: () => set({ isQuickPasteOpen: true }),
  closeQuickPaste: () => set({ isQuickPasteOpen: false }),
}));
