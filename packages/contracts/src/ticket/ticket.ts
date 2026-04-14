export type TicketKind =
  | "research"
  | "plan"
  | "implement"
  | "review"
  | "operate";

export type TicketStatus =
  | "todo"
  | "claimed"
  | "in_progress"
  | "blocked"
  | "awaiting_approval"
  | "done"
  | "failed"
  | "cancelled";

export type ExecutionAdapterId =
  | "codex_responses"
  | "codex_exec"
  | "codex_sdk";

export interface TicketExecutionHandle {
  adapter: ExecutionAdapterId;
  adapterState: Record<string, unknown>;
}

export interface Ticket {
  id: string;
  missionId: string;
  kind: TicketKind;
  goal: string;
  status: TicketStatus;
  owner: string;
  dependsOn: string[];
  successCriteria: string[];
  allowedCapabilities: string[];
  skillPackRefs: string[];
  workspaceIsolationId: string | null;
  executionHandle: TicketExecutionHandle;
  artifactIds: string[];
  eventIds: string[];
  createdAt: string;
  updatedAt: string;
}

/**
 * Statuts terminaux d'un ticket. Une fois atteint, aucun flux de mutation
 * metier ne doit continuer a modifier le ticket.
 */
export const TERMINAL_TICKET_STATUSES = [
  "done",
  "failed",
  "cancelled",
] as const satisfies readonly TicketStatus[];

/**
 * Statuts qui interdisent les mises a jour de contenu via `ticket update`.
 * Les transitions de statut restent reservees aux commandes dediees.
 */
export const NON_UPDATABLE_TICKET_STATUSES = [
  "done",
  "failed",
  "cancelled",
  "claimed",
  "in_progress",
  "blocked",
] as const satisfies readonly TicketStatus[];

export const TICKET_KINDS: TicketKind[] = [
  "research",
  "plan",
  "implement",
  "review",
  "operate",
];
