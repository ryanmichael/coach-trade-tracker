// Notification Engine — delivers alerts through available channels
// v1: In-app toast, alert banner, browser tab title flash, audio cue
// v2: Web Push, email digest, SMS via Twilio

import type { Alert } from "@repo/shared";

export class Notifier {
  async dispatch(_alert: Alert): Promise<void> {
    // TODO: implement notification dispatch
  }
}
