import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import type { ExecutionAdapterOutput } from "../../packages/contracts/src/execution-attempt/execution-attempt";
import type { JournalEventRecord } from "../../packages/journal/src/event-log/append-event";
import { detectTicketArtifacts } from "../../packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts";
import type { WorkspaceIsolationMetadata } from "../../packages/workspace-isolation/src/workspace-isolation";

function createIsolation(sourceRoot: string, workspacePath: string): WorkspaceIsolationMetadata {
  return {
    workspaceIsolationId: "iso_detect",
    kind: "workspace_copy",
    sourceRoot,
    workspacePath,
    createdAt: "2026-04-10T00:00:00.000Z",
    retained: true,
  };
}

function createProducingEvent(): JournalEventRecord {
  return {
    eventId: "event_terminal",
    type: "execution.completed",
    missionId: "mission_detect",
    ticketId: "ticket_detect",
    attemptId: "attempt_detect",
    occurredAt: "2026-04-10T00:00:00.000Z",
    actor: "adapter",
    source: "codex_responses",
    payload: {},
  };
}

test("detectTicketArtifacts echoue explicitement sur un kind d'output inconnu", async (t) => {
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "corp-detect-source-"));
  const workspacePath = await mkdtemp(path.join(tmpdir(), "corp-detect-workspace-"));

  t.after(async () => {
    await rm(sourceRoot, { recursive: true, force: true });
    await rm(workspacePath, { recursive: true, force: true });
  });

  await assert.rejects(
    detectTicketArtifacts({
      adapterOutputs: [
        {
          kind: "video",
          title: "Sortie video",
        } as unknown as ExecutionAdapterOutput,
      ],
      isolation: createIsolation(sourceRoot, workspacePath),
      producingEvent: createProducingEvent(),
    }),
    /Kind d'output adaptateur non reconnu: video/,
  );
});

test("detectTicketArtifacts renseigne sizeBytes meme quand un structured_output volumineux n'a pas de payload inline", async (t) => {
  const sourceRoot = await mkdtemp(path.join(tmpdir(), "corp-detect-large-source-"));
  const workspacePath = await mkdtemp(path.join(tmpdir(), "corp-detect-large-workspace-"));

  t.after(async () => {
    await rm(sourceRoot, { recursive: true, force: true });
    await rm(workspacePath, { recursive: true, force: true });
  });

  const artifacts = await detectTicketArtifacts({
    adapterOutputs: [
      {
        kind: "structured",
        title: "Rapport massif",
        data: {
          text: "€".repeat(7000),
        },
      },
    ],
    isolation: createIsolation(sourceRoot, workspacePath),
    producingEvent: createProducingEvent(),
  });

  assert.equal(artifacts.length, 1);
  assert.equal(artifacts[0]?.kind, "structured_output");
  assert.equal(artifacts[0]?.payload, undefined);
  assert.ok((artifacts[0]?.sizeBytes ?? 0) > 16000);
  assert.match(artifacts[0]?.summary ?? "", /payload tronque/i);
});
