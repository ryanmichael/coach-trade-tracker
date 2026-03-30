// Orchestration Agent — coordinates all specialist agents
// Manages execution order, handles errors and retries, maintains system state
// State machine: IDLE → INGESTING → PARSING → MONITORING → ALERTING → IDLE

export type OrchestratorState =
  | "idle"
  | "ingesting"
  | "parsing"
  | "monitoring"
  | "alerting";

export class Orchestrator {
  private state: OrchestratorState = "idle";

  getState(): OrchestratorState {
    return this.state;
  }

  // TODO: implement full orchestration pipeline
}
