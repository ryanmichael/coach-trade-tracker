import { create } from "zustand";

interface SelectionState {
  selected: string | null; // null = nothing selected, otherwise a ticker symbol
  mobileShowDetail: boolean;
  setSelected: (value: string | null) => void;
  setMobileShowDetail: (value: boolean) => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selected: null,
  mobileShowDetail: false,
  setSelected: (value) => set({ selected: value, mobileShowDetail: true }),
  setMobileShowDetail: (value) => set({ mobileShowDetail: value }),
}));
