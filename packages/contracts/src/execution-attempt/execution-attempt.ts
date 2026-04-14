import type { ExecutionAdapterId } from "../ticket/ticket";

export type ExecutionAttemptStatus =
  | "requested"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export interface ExecutionAttempt {
  id: string;
  ticketId: string;
  adapter: ExecutionAdapterId;
  status: ExecutionAttemptStatus;
  workspaceIsolationId: string;
  backgroundRequested: boolean;
  adapterState: Record<string, unknown>;
  startedAt: string;
  endedAt: string | null;
}

export interface ExecutionAdapterTextOutput {
  kind: "text";
  title: string;
  text: string;
  label?: string;
  mediaType?: string;
  summary?: string;
}

export interface ExecutionAdapterStructuredOutput {
  kind: "structured";
  title: string;
  data: unknown;
  label?: string;
  mediaType?: string;
  summary?: string;
}

export interface ExecutionAdapterReferenceOutput {
  kind: "reference";
  title: string;
  label?: string;
  mediaType?: string;
  summary?: string;
  path?: string;
}

export type ExecutionAdapterOutput =
  | ExecutionAdapterTextOutput
  | ExecutionAdapterStructuredOutput
  | ExecutionAdapterReferenceOutput;

export const ACTIVE_EXECUTION_ATTEMPT_STATUSES: ExecutionAttemptStatus[] = [
  "requested",
  "running",
  "awaiting_approval",
];
