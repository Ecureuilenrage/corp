import type {
  ExecutionAdapterOutput,
  ExecutionAttemptStatus,
} from "../../../contracts/src/execution-attempt/execution-attempt";
import type { ApprovalRequest } from "../../../contracts/src/approval/approval-request";
import type { ResolvedSkillPackSummary } from "../../../contracts/src/extension/registered-skill-pack";
import type { Mission } from "../../../contracts/src/mission/mission";
import type {
  ExecutionAdapterId,
  Ticket,
} from "../../../contracts/src/ticket/ticket";

export interface ExecutionAdapterLaunchOptions {
  mission: Mission;
  ticket: Ticket;
  attemptId: string;
  workspacePath: string;
  background: boolean;
  resolvedSkillPacks: ResolvedSkillPackSummary[];
}

export interface ExecutionAdapterApprovalRequest {
  title: ApprovalRequest["title"];
  actionType: ApprovalRequest["actionType"];
  actionSummary: ApprovalRequest["actionSummary"];
  guardrails?: ApprovalRequest["guardrails"];
  relatedEventIds?: ApprovalRequest["relatedEventIds"];
  relatedArtifactIds?: ApprovalRequest["relatedArtifactIds"];
}

export type ExecutionAdapterLaunchResult =
  | {
    status: Exclude<ExecutionAttemptStatus, "awaiting_approval">;
    adapterState: Record<string, unknown>;
    outputs?: ExecutionAdapterOutput[];
    approvalRequest?: undefined;
  }
  | {
    status: "awaiting_approval";
    adapterState: Record<string, unknown>;
    outputs?: ExecutionAdapterOutput[];
    approvalRequest: ExecutionAdapterApprovalRequest;
  };

export interface ExecutionAdapter {
  id: ExecutionAdapterId;
  launch(options: ExecutionAdapterLaunchOptions): Promise<ExecutionAdapterLaunchResult>;
}

export interface CodexResponsesAdapterConfig {
  apiKey: string;
  model: string;
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export interface ResponsesApiResponse {
  id?: string;
  status?: string;
  output_text?: string;
  sequence_number?: number;
  output?: unknown[];
}

export function createCodexResponsesAdapterFromEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  overrides: Partial<CodexResponsesAdapterConfig> = {},
): ExecutionAdapter {
  const apiKey = overrides.apiKey ?? env.OPENAI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error(
      "Secret OpenAI absent. Renseignez `OPENAI_API_KEY` avant `corp mission ticket run`.",
    );
  }

  return createCodexResponsesAdapter({
    apiKey,
    model: overrides.model ?? (env.CORP_CODEX_RESPONSES_MODEL?.trim() || "gpt-5-codex"),
    endpoint: overrides.endpoint ?? (env.OPENAI_BASE_URL?.trim() || "https://api.openai.com/v1"),
    fetchImpl: overrides.fetchImpl,
    timeoutMs: overrides.timeoutMs ?? resolveResponsesTimeoutMs(env.CORP_CODEX_RESPONSES_TIMEOUT_MS),
  });
}

export function createCodexResponsesAdapter(
  config: CodexResponsesAdapterConfig,
): ExecutionAdapter {
  const fetchImpl = config.fetchImpl ?? fetch;
  const timeoutMs = config.timeoutMs ?? 300000;

  return {
    id: "codex_responses",
    launch: async (options: ExecutionAdapterLaunchOptions): Promise<ExecutionAdapterLaunchResult> => {
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
      timeoutHandle.unref?.();

      try {
        const response = await fetchImpl(`${config.endpoint ?? "https://api.openai.com/v1"}/responses`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildRequestBody(options, config.model)),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw new Error(`Responses API returned HTTP ${response.status}.`);
        }

        const payload = await response.json() as ResponsesApiResponse;
        const mappedStatus = mapResponseStatus(payload.status);

        const adapterState = {
          ...(typeof payload.id === "string" ? { responseId: payload.id } : {}),
          ...(typeof payload.sequence_number === "number"
            ? { sequenceNumber: payload.sequence_number }
            : {}),
          ...(typeof payload.status === "string" ? { vendorStatus: payload.status } : {}),
          ...(options.background && typeof payload.id === "string"
            ? { pollCursor: payload.id }
            : {}),
        };

        if (mappedStatus === "awaiting_approval") {
          return {
            status: "awaiting_approval",
            adapterState,
            outputs: normalizeResponseOutputs(payload),
            approvalRequest: extractApprovalRequestFromPayload(payload),
          };
        }

        return {
          status: mappedStatus,
          adapterState,
          outputs: normalizeResponseOutputs(payload),
        };
      } catch (error) {
        if (isAbortError(error)) {
          throw new Error(`Responses API request timed out after ${timeoutMs}ms.`);
        }

        throw error;
      } finally {
        clearTimeout(timeoutHandle);
      }
    },
  };
}

export function mapResponseStatus(status: string | undefined): ExecutionAttemptStatus {
  if (status === "queued") {
    return "requested";
  }

  if (status === "in_progress") {
    return "running";
  }

  if (status === "completed") {
    return "completed";
  }

  if (status === "cancelled") {
    return "cancelled";
  }

  if (status === "requires_action") {
    return "awaiting_approval";
  }

  if (status === "failed" || status === undefined) {
    return "failed";
  }

  throw new Error(
    `Statut vendor inconnu: "${status}". Mapping impossible vers un ExecutionAttemptStatus valide.`,
  );
}

export function buildRequestBody(
  options: ExecutionAdapterLaunchOptions,
  model: string,
): Record<string, unknown> {
  return {
    model,
    background: options.background,
    store: options.background,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "Vous executez un ticket corp dans un workspace isole. Restez borne au ticket et a la mission.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: buildExecutionBrief(options),
          },
        ],
      },
    ],
    metadata: {
      mission_id: options.mission.id,
      ticket_id: options.ticket.id,
      attempt_id: options.attemptId,
    },
  };
}

function buildExecutionBrief(options: ExecutionAdapterLaunchOptions): string {
  const lines = [
    `Mission: ${options.mission.title}`,
    `Objectif mission: ${options.mission.objective}`,
    `Policy profile: ${options.mission.policyProfileId}`,
    `Ticket: ${options.ticket.goal}`,
    `Owner: ${options.ticket.owner}`,
    `Allowed capabilities: ${formatExecutionList(options.ticket.allowedCapabilities, "aucune")}`,
    `Skill packs: ${formatExecutionList(options.ticket.skillPackRefs, "aucun")}`,
    `Workspace isole: ${options.workspacePath}`,
    `Criteres de succes: ${options.ticket.successCriteria.join(" | ")}`,
  ];

  if (options.resolvedSkillPacks.length > 0) {
    lines.push("Skill pack summaries:");

    for (const skillPack of options.resolvedSkillPacks) {
      lines.push(formatSkillPackSummary(skillPack));
    }
  }

  return lines.join("\n");
}

function formatExecutionList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}

function formatSkillPackSummary(skillPack: ResolvedSkillPackSummary): string {
  return [
    `- ${skillPack.packRef} | ${skillPack.displayName} | ${skillPack.description}`,
    `root: ${skillPack.rootDir}`,
    `refs: ${formatExecutionList(skillPack.references, "aucune")}`,
    `metadata: ${skillPack.metadataFile ?? "aucun"}`,
    `scripts: ${formatExecutionList(skillPack.scripts, "aucun")}`,
  ].join(" | ");
}

export function normalizeResponseOutputs(payload: ResponsesApiResponse): ExecutionAdapterOutput[] {
  const outputs: ExecutionAdapterOutput[] = [];
  const seenOutputKeys = new Set<string>();

  const topLevelText = normalizeTextValue(payload.output_text);

  if (topLevelText) {
    registerOutput(
      outputs,
      seenOutputKeys,
      {
        kind: "text",
        title: "Synthese adapteur",
        text: topLevelText,
        mediaType: "text/plain",
      },
    );
  }

  const responseOutputs = Array.isArray(payload.output) ? payload.output : [];
  let textIndex = 1;
  let structuredIndex = 1;

  for (const rawOutput of responseOutputs) {
    if (typeof rawOutput !== "object" || rawOutput === null) {
      continue;
    }

    const outputRecord = rawOutput as Record<string, unknown>;
    const contentItems = Array.isArray(outputRecord.content)
      ? outputRecord.content
      : [];

    for (const contentItem of contentItems) {
      if (typeof contentItem !== "object" || contentItem === null) {
        continue;
      }

      const contentRecord = contentItem as Record<string, unknown>;
      const textValue = normalizeTextValue(
        contentRecord.text ?? contentRecord.output_text,
      );

      if (textValue) {
        registerOutput(
          outputs,
          seenOutputKeys,
          {
            kind: "text",
            title: `Texte de reponse ${textIndex}`,
            text: textValue,
            mediaType: "text/plain",
          },
        );
        textIndex += 1;
      }

      const structuredValue = extractStructuredValue(contentRecord);

      if (structuredValue !== undefined) {
        registerOutput(
          outputs,
          seenOutputKeys,
          {
            kind: "structured",
            title: `Sortie structuree ${structuredIndex}`,
            data: structuredValue,
            mediaType: "application/json",
          },
        );
        structuredIndex += 1;
      }
    }

    const directStructuredValue = extractStructuredValue(outputRecord);

    if (directStructuredValue !== undefined) {
      registerOutput(
        outputs,
        seenOutputKeys,
        {
          kind: "structured",
          title: `Sortie structuree ${structuredIndex}`,
          data: directStructuredValue,
          mediaType: "application/json",
        },
      );
      structuredIndex += 1;
    }
  }

  if (outputs.length === 0 && responseOutputs.length > 0) {
    outputs.push({
      kind: "reference",
      title: "Sortie adapteur",
      summary: "Des sorties foreground ont ete produites par l'adaptateur.",
    });
  }

  return outputs;
}

function extractStructuredValue(record: Record<string, unknown>): unknown {
  for (const key of ["json", "parsed", "value", "result"]) {
    if (!(key in record)) {
      continue;
    }

    const candidate = record[key];

    if (typeof candidate === "object" && candidate !== null) {
      return candidate;
    }
  }

  return undefined;
}

function normalizeTextValue(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function registerOutput(
  outputs: ExecutionAdapterOutput[],
  seenOutputKeys: Set<string>,
  output: ExecutionAdapterOutput,
): void {
  const dedupeKey = JSON.stringify(output);

  if (seenOutputKeys.has(dedupeKey)) {
    return;
  }

  seenOutputKeys.add(dedupeKey);
  outputs.push(output);
}

function extractApprovalRequestFromPayload(
  payload: ResponsesApiResponse,
): ExecutionAdapterApprovalRequest {
  const outputItems = Array.isArray(payload.output) ? payload.output : [];
  let title = "Validation requise pour une action sensible";
  let actionType = "sensitive_action";
  let actionSummary = "Une action sensible requiert une validation operateur avant execution.";
  const guardrails: string[] = [];

  for (const rawItem of outputItems) {
    if (typeof rawItem !== "object" || rawItem === null) {
      continue;
    }

    const item = rawItem as Record<string, unknown>;

    if (item.type === "approval_request" || item.type === "action_required") {
      if (typeof item.title === "string" && item.title.trim().length > 0) {
        title = item.title.trim();
      }

      if (typeof item.action_type === "string" && item.action_type.trim().length > 0) {
        actionType = item.action_type.trim();
      }

      if (typeof item.summary === "string" && item.summary.trim().length > 0) {
        actionSummary = item.summary.trim();
      }

      if (Array.isArray(item.guardrails)) {
        for (const guardrail of item.guardrails) {
          if (typeof guardrail === "string" && guardrail.trim().length > 0) {
            guardrails.push(guardrail.trim());
          }
        }
      }

      break;
    }
  }

  return {
    title,
    actionType,
    actionSummary,
    ...(guardrails.length > 0 ? { guardrails } : {}),
  };
}

function resolveResponsesTimeoutMs(rawTimeoutMs: string | undefined): number {
  const parsedTimeoutMs = Number.parseInt(rawTimeoutMs ?? "", 10);
  return Number.isFinite(parsedTimeoutMs) && parsedTimeoutMs > 0
    ? parsedTimeoutMs
    : 300000;
}

function isAbortError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "name" in error
    && error.name === "AbortError";
}
