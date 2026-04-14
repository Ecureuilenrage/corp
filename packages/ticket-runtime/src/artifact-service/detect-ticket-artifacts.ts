import type { ArtifactKind } from "../../../contracts/src/artifact/artifact";
import type {
  ExecutionAdapterOutput,
} from "../../../contracts/src/execution-attempt/execution-attempt";
import type { JournalEventRecord } from "../../../journal/src/event-log/append-event";
import type { WorkspaceIsolationMetadata } from "../../../workspace-isolation/src/workspace-isolation";
import { detectWorkspaceArtifacts } from "../../../workspace-isolation/src/workspace-artifact-detector";

const MAX_STORED_TEXT_LENGTH = 4000;
const MAX_STORED_JSON_LENGTH = 16000;

export interface DetectedArtifactPayload {
  fileName: string;
  contents: string;
}

export interface DetectedArtifactCandidate {
  kind: ArtifactKind;
  title: string;
  label?: string;
  path?: string;
  mediaType?: string;
  summary?: string;
  payload?: DetectedArtifactPayload;
  sha256?: string;
  sizeBytes?: number;
}

export async function detectTicketArtifacts(options: {
  adapterOutputs?: ExecutionAdapterOutput[];
  isolation: WorkspaceIsolationMetadata;
  producingEvent: JournalEventRecord;
}): Promise<DetectedArtifactCandidate[]> {
  if (!isConcreteArtifactEvent(options.producingEvent)) {
    return [];
  }

  const adapterArtifacts = normalizeAdapterOutputs(options.adapterOutputs ?? []);
  const workspaceArtifacts = await detectWorkspaceArtifacts(options.isolation);

  return [
    ...adapterArtifacts,
    ...workspaceArtifacts,
  ];
}

function normalizeAdapterOutputs(outputs: ExecutionAdapterOutput[]): DetectedArtifactCandidate[] {
  const detectedArtifacts: DetectedArtifactCandidate[] = [];

  for (const output of outputs) {
    const normalizedArtifact = normalizeAdapterOutput(output);

    if (!normalizedArtifact) {
      continue;
    }

    detectedArtifacts.push(normalizedArtifact);
  }

  return detectedArtifacts;
}

function normalizeAdapterOutput(
  output: ExecutionAdapterOutput,
): DetectedArtifactCandidate | null {
  switch (output.kind) {
    case "text": {
      const normalizedText = output.text.trim();

      if (normalizedText.length === 0) {
        return null;
      }

      const storedText = truncateValue(normalizedText, MAX_STORED_TEXT_LENGTH);

      return {
        kind: "report_text",
        title: output.title,
        ...(output.label ? { label: output.label } : {}),
        ...(output.mediaType ? { mediaType: output.mediaType } : {}),
        summary: output.summary ?? summarizeText(normalizedText),
        payload: {
          fileName: "payload.txt",
          contents: storedText,
        },
        sizeBytes: Buffer.byteLength(storedText, "utf8"),
      };
    }

    case "structured": {
      const serializedData = JSON.stringify(output.data, null, 2);
      const sizeBytes = Buffer.byteLength(serializedData, "utf8");
      const payload = sizeBytes <= MAX_STORED_JSON_LENGTH
        ? {
          fileName: "payload.json",
          contents: serializedData,
        }
        : undefined;
      const baseSummary = output.summary ?? summarizeText(serializedData);

      return {
        kind: "structured_output",
        title: output.title,
        ...(output.label ? { label: output.label } : {}),
        ...(output.mediaType ? { mediaType: output.mediaType } : {}),
        summary: payload
          ? baseSummary
          : `${baseSummary} (payload tronque)`,
        ...(payload ? { payload } : {}),
        sizeBytes,
      };
    }

    case "reference":
      return {
        kind: "diagnostic_pointer",
        title: output.title,
        ...(output.label ? { label: output.label } : {}),
        ...(output.path ? { path: output.path } : {}),
        ...(output.mediaType ? { mediaType: output.mediaType } : {}),
        summary: output.summary ?? "Sortie adapteur referencee sans transcript brut.",
      };
  }

  return assertUnknownExecutionAdapterOutput(output);
}

function summarizeText(value: string): string {
  const normalizedValue = value.replace(/\s+/g, " ").trim();
  return truncateValue(normalizedValue, 140);
}

function truncateValue(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function isConcreteArtifactEvent(event: JournalEventRecord): boolean {
  return event.type === "execution.completed" || event.type === "execution.failed";
}

function assertUnknownExecutionAdapterOutput(output: never): never {
  const rawKind = (output as { kind?: unknown }).kind;
  throw new Error(`Kind d'output adaptateur non reconnu: ${String(rawKind)}`);
}
