// Alert condition evaluation
// Checks price confirmation, target reached, and stop loss conditions

import type { ActiveTrade, Alert } from "@repo/shared";

export interface AlertConditionResult {
  triggered: boolean;
  alert: Omit<Alert, "id" | "createdAt"> | null;
}

export function evaluateAlertConditions(
  _trade: ActiveTrade,
  _currentPrice: number
): AlertConditionResult[] {
  // TODO: implement alert condition checks
  return [];
}
