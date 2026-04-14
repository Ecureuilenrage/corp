export type ArtifactKind =
  | "workspace_file"
  | "report_text"
  | "structured_output"
  | "diagnostic_pointer";

export interface Artifact {
  id: string;
  missionId: string;
  ticketId: string;
  producingEventId: string;
  attemptId: string | null;
  workspaceIsolationId: string | null;
  kind: ArtifactKind;
  title: string;
  createdAt: string;
  label?: string;
  path?: string;
  mediaType?: string;
  summary?: string;
  payloadPath?: string;
  sha256?: string;
  sizeBytes?: number;
  sourceEventType?: string;
  sourceEventOccurredAt?: string;
}
