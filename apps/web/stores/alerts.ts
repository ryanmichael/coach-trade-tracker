import { create } from "zustand";
import { persist } from "zustand/middleware";

export type AlertType = "confirmation" | "target" | "stopLoss" | "newPost";

export interface TickerAlert {
  type: AlertType;
  message: string;
  active: boolean;
}

export interface Toast {
  id: string;
  type: AlertType;
  ticker: string;
  message: string;
  createdAt: number;
}

export interface HistoryAlert {
  id: string;
  type: AlertType;
  ticker: string;
  message: string;
  createdAt: number;
  read: boolean;
}

interface AlertsState {
  // Per-ticker alert (shown as inline alert in detail view + flag on card)
  tickerAlerts: Record<string, TickerAlert>;
  // Which tickers have unread alerts (drives flag column)
  unreadAlerts: Record<string, boolean>;
  // Ephemeral toast queue (not persisted)
  toasts: Toast[];
  // Permanent notification history (persisted)
  history: HistoryAlert[];
  // Keys of alerts that have already fired — prevents re-firing across sessions
  firedAlerts: string[];

  dismissTickerAlert: (symbol: string) => void;
  setTickerAlert: (symbol: string, alert: TickerAlert) => void;
  markRead: (symbol: string) => void;
  addToast: (toast: Omit<Toast, "id" | "createdAt">) => void;
  dismissToast: (id: string) => void;
  markAllHistoryRead: () => void;
  clearHistory: () => void;
  addFiredAlert: (key: string) => void;
  removeFiredAlert: (key: string) => void;
}

let idCounter = 0;
const nextId = () => `alert-${Date.now()}-${++idCounter}`;

export const useAlertsStore = create<AlertsState>()(
  persist(
    (set) => ({
      tickerAlerts: {},
      unreadAlerts: {},
      toasts: [],
      history: [],
      firedAlerts: [],

      dismissTickerAlert: (symbol) =>
        set((state) => ({
          tickerAlerts: {
            ...state.tickerAlerts,
            [symbol]: { ...state.tickerAlerts[symbol], active: false },
          },
          unreadAlerts: { ...state.unreadAlerts, [symbol]: false },
        })),

      setTickerAlert: (symbol, alert) =>
        set((state) => ({
          tickerAlerts: { ...state.tickerAlerts, [symbol]: alert },
          unreadAlerts: { ...state.unreadAlerts, [symbol]: true },
        })),

      markRead: (symbol) =>
        set((state) => ({
          unreadAlerts: { ...state.unreadAlerts, [symbol]: false },
        })),

      addToast: (toast) => {
        const id = nextId();
        const createdAt = Date.now();
        set((state) => {
          const toasts = [...state.toasts, { ...toast, id, createdAt }];
          // Only price confirmation events go into persistent notification history
          if (toast.type !== "confirmation") return { toasts };
          const historyEntry: HistoryAlert = { ...toast, id, createdAt, read: false };
          return { toasts, history: [historyEntry, ...state.history].slice(0, 100) };
        });
      },

      dismissToast: (id) =>
        set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),

      markAllHistoryRead: () =>
        set((state) => ({
          history: state.history.map((h) => ({ ...h, read: true })),
        })),

      clearHistory: () => set({ history: [] }),

      addFiredAlert: (key) =>
        set((state) => ({
          firedAlerts: state.firedAlerts.includes(key)
            ? state.firedAlerts
            : [...state.firedAlerts, key],
        })),

      removeFiredAlert: (key) =>
        set((state) => ({
          firedAlerts: state.firedAlerts.filter((k) => k !== key),
        })),
    }),
    {
      name: "coachtrack-alerts",
      // Only persist the fields that need to survive page refresh.
      // toasts are ephemeral — never persist them.
      partialize: (state) => ({
        tickerAlerts: state.tickerAlerts,
        unreadAlerts: state.unreadAlerts,
        history: state.history,
        firedAlerts: state.firedAlerts,
      }),
    }
  )
);

export const ALERT_META: Record<
  AlertType,
  { label: string; color: string; bg: string; icon: string }
> = {
  confirmation: {
    label: "Price Confirmed",
    color: "var(--semantic-positive)",
    bg: "var(--semantic-positive-muted)",
    icon: "✓",
  },
  target: {
    label: "Target Reached",
    color: "var(--semantic-warning)",
    bg: "var(--semantic-warning-muted)",
    icon: "🎯",
  },
  stopLoss: {
    label: "Stop Loss Hit",
    color: "var(--semantic-negative)",
    bg: "var(--semantic-negative-muted)",
    icon: "⚠",
  },
  newPost: {
    label: "New Post",
    color: "var(--semantic-info)",
    bg: "var(--semantic-info-muted)",
    icon: "💬",
  },
};
