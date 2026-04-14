import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  unlink,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";
import { setRunTicketDependenciesForTesting } from "../../packages/ticket-runtime/src/ticket-service/run-ticket";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

interface JournalEventRecord {
  eventId: string;
  type: string;
  missionId: string;
  ticketId?: string;
  attemptId?: string;
  occurredAt: string;
  actor: string;
  source: string;
  payload: Record<string, unknown>;
}

interface ArtifactIndexEntry {
  artifactId: string;
  missionId: string;
  ticketId: string;
  producingEventId: string;
  attemptId: string | null;
  workspaceIsolationId: string | null;
  kind: string;
  title: string;
  label?: string;
  path?: string;
  mediaType?: string;
  summary?: string;
  payloadPath?: string;
  sha256?: string;
  sizeBytes?: number;
  sourceEventType?: string;
  sourceEventOccurredAt?: string;
  sourceActor?: string;
  source?: string;
  ticketOwner?: string;
  createdAt: string;
}

interface ArtifactIndexProjection {
  schemaVersion: 1;
  artifacts: ArtifactIndexEntry[];
}

async function runCommand(args: string[]): Promise<CommandResult> {
  const lines: string[] = [];
  const exitCode = await runCli(args, {
    writeLine: (line: string) => lines.push(line),
  });

  return {
    exitCode,
    lines,
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function bootstrapWorkspace(rootDir: string): Promise<void> {
  const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(result.exitCode, 0);
}

async function createMission(rootDir: string): Promise<Mission> {
  const result = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission artefacts",
    "--objective",
    "Capturer les sorties d'un ticket sans transcript brut",
    "--success-criterion",
    "Les artefacts sont consultables",
    "--success-criterion",
    "La reprise reste fiable",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
  assert.ok(line, "la creation doit retourner un missionId");

  return readJson<Mission>(
    path.join(rootDir, ".corp", "missions", line.slice("Mission creee: ".length), "mission.json"),
  );
}

async function createTicket(rootDir: string, missionId: string): Promise<Ticket> {
  const result = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Produire plusieurs sorties auditables",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Les sorties sont detectees",
  ]);

  assert.equal(result.exitCode, 0);

  const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
  assert.ok(line, "la creation doit retourner un ticketId");

  return readJson<Ticket>(
    path.join(
      rootDir,
      ".corp",
      "missions",
      missionId,
      "tickets",
      line.slice("Ticket cree: ".length),
      "ticket.json",
    ),
  );
}

async function readMission(rootDir: string, missionId: string): Promise<Mission> {
  return readJson<Mission>(
    path.join(rootDir, ".corp", "missions", missionId, "mission.json"),
  );
}

async function readTicket(rootDir: string, missionId: string, ticketId: string): Promise<Ticket> {
  return readJson<Ticket>(
    path.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"),
  );
}

async function readJournal(rootDir: string): Promise<JournalEventRecord[]> {
  return (await readFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as JournalEventRecord);
}

async function prepareMissionWithArtifacts(rootDir: string): Promise<{
  missionId: string;
  ticketId: string;
  attemptId: string;
  projection: ArtifactIndexProjection;
}> {
  await bootstrapWorkspace(rootDir);
  await writeFile(path.join(rootDir, "README.md"), "README initial\n", "utf8");

  const mission = await createMission(rootDir);
  const ticket = await createTicket(rootDir, mission.id);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async ({ workspacePath }) => {
        await writeFile(path.join(workspacePath, "README.md"), "README modifie\n", "utf8");
        await mkdir(path.join(workspacePath, "bin"), { recursive: true });
        await writeFile(
          path.join(workspacePath, "bin", "payload.bin"),
          Buffer.from([0, 1, 2, 3, 4, 5]),
        );

        return {
          status: "completed",
          adapterState: {
            responseId: "resp_artifact_123",
            sequenceNumber: 17,
            vendorStatus: "completed",
            pollCursor: "cursor_artifact_123",
          },
          outputs: [
            {
              kind: "text",
              title: "Synthese operateur",
              label: "synthese",
              mediaType: "text/plain",
              text: "Synthese utile pour l'operateur.\nLe ticket a produit des sorties locales.",
              summary: "Synthese courte du run foreground.",
            },
            {
              kind: "structured",
              title: "Rapport structure",
              label: "rapport",
              mediaType: "application/json",
              data: {
                result: "ok",
                generatedFiles: ["README.md", "bin/payload.bin"],
                detail: "structure exploitable cote corp",
              },
              summary: "Rapport JSON borne pour diagnostic.",
            },
          ],
        };
      },
    }),
  });

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticket.id,
  ]);

  assert.equal(runResult.exitCode, 0);

  const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
  assert.ok(attemptLine, "la commande doit annoncer l'attempt");

  const projection = await readJson<ArtifactIndexProjection>(
    path.join(rootDir, ".corp", "projections", "artifact-index.json"),
  );

  return {
    missionId: mission.id,
    ticketId: ticket.id,
    attemptId: attemptLine.slice("Tentative ouverte: ".length),
    projection,
  };
}

test("mission ticket run foreground enregistre plusieurs artefacts et expose une navigation mission-centrique sans fuite vendor", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-artifact-index-foreground-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const prepared = await prepareMissionWithArtifacts(rootDir);
  const updatedMission = await readMission(rootDir, prepared.missionId);
  const updatedTicket = await readTicket(rootDir, prepared.missionId, prepared.ticketId);
  const journal = await readJournal(rootDir);
  const executionCompletedEvent = journal.find((event) => event.type === "execution.completed");
  const listResult = await runCommand([
    "mission",
    "artifact",
    "list",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);
  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);

  assert.ok(executionCompletedEvent, "un evenement terminal doit exister");
  assert.equal(prepared.projection.schemaVersion, 1);
  assert.equal(prepared.projection.artifacts.length, 4);
  assert.equal(updatedMission.artifactIds.length, 4);
  assert.deepEqual(updatedMission.artifactIds, updatedTicket.artifactIds);

  for (const artifact of prepared.projection.artifacts) {
    assert.equal(artifact.missionId, prepared.missionId);
    assert.equal(artifact.ticketId, prepared.ticketId);
    assert.equal(artifact.attemptId, prepared.attemptId);
    assert.ok(artifact.workspaceIsolationId);
    assert.equal(artifact.producingEventId, executionCompletedEvent.eventId);
    assert.equal(artifact.sourceEventType, "execution.completed");
    assert.equal(artifact.sourceActor, "adapter");
    assert.equal(typeof artifact.createdAt, "string");
  }

  const workspaceArtifacts = prepared.projection.artifacts.filter((artifact) =>
    artifact.kind === "workspace_file"
  );
  assert.equal(workspaceArtifacts.length, 2);
  assert.ok(workspaceArtifacts.some((artifact) => artifact.path === "README.md"));
  assert.ok(workspaceArtifacts.some((artifact) => artifact.path === "bin/payload.bin"));
  assert.ok(workspaceArtifacts.every((artifact) => typeof artifact.sha256 === "string"));
  assert.ok(workspaceArtifacts.every((artifact) => typeof artifact.sizeBytes === "number"));

  const adapterTextArtifact = prepared.projection.artifacts.find((artifact) =>
    artifact.kind === "report_text"
  );
  assert.ok(adapterTextArtifact);
  assert.ok(adapterTextArtifact.payloadPath);

  const adapterStructuredArtifact = prepared.projection.artifacts.find((artifact) =>
    artifact.kind === "structured_output"
  );
  assert.ok(adapterStructuredArtifact);
  assert.ok(adapterStructuredArtifact.payloadPath);

  const artifactEvents = journal.filter((event) =>
    event.type === "artifact.detected" || event.type === "artifact.registered"
  );
  assert.equal(artifactEvents.length, 8);
  assert.ok(artifactEvents.every((event) => event.attemptId === prepared.attemptId));

  assert.equal(listResult.exitCode, 0);
  assert.match(listResult.lines.join("\n"), /Artefacts de mission:/);
  assert.match(listResult.lines.join("\n"), new RegExp(prepared.ticketId));
  assert.match(listResult.lines.join("\n"), /kind=workspace_file/);
  assert.match(listResult.lines.join("\n"), /kind=report_text/);
  assert.match(listResult.lines.join("\n"), /kind=structured_output/);
  assert.doesNotMatch(
    listResult.lines.join("\n"),
    /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i,
  );

  const showResult = await runCommand([
    "mission",
    "artifact",
    "show",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
    "--artifact-id",
    adapterTextArtifact.artifactId,
  ]);

  assert.equal(showResult.exitCode, 0);
  assert.match(showResult.lines.join("\n"), new RegExp(`Mission: ${prepared.missionId}`));
  assert.match(showResult.lines.join("\n"), new RegExp(`Ticket: ${prepared.ticketId}`));
  assert.match(showResult.lines.join("\n"), new RegExp(`Artefact: ${adapterTextArtifact.artifactId}`));
  assert.match(showResult.lines.join("\n"), /Type source: execution.completed/);
  assert.match(showResult.lines.join("\n"), /Acteur: adapter/);
  assert.match(showResult.lines.join("\n"), /Preview:/);
  assert.match(showResult.lines.join("\n"), /Synthese utile pour l'operateur/);
  assert.doesNotMatch(
    showResult.lines.join("\n"),
    /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i,
  );

  assert.equal(resumeResult.exitCode, 0);
  assert.match(
    resumeResult.lines.join("\n"),
    /Dernier artefact pertinent: (Synthese operateur|README\.md|Rapport structure|payload\.bin)/,
  );
  assert.doesNotMatch(
    resumeResult.lines.join("\n"),
    /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i,
  );

  assert.equal(statusResult.exitCode, 0);
  assert.match(statusResult.lines.join("\n"), /Dernier artefact pertinent: /);
  assert.doesNotMatch(
    statusResult.lines.join("\n"),
    /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i,
  );

  const artifactIndexRaw = await readFile(
    path.join(rootDir, ".corp", "projections", "artifact-index.json"),
    "utf8",
  );
  assert.doesNotMatch(
    artifactIndexRaw,
    /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor|structure exploitable cote corp.*response/i,
  );
});

test("mission ticket run foreground avec status failed et outputs enregistre quand meme les artefacts", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-artifact-index-failed-outputs-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir);
  const ticket = await createTicket(rootDir, mission.id);

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "failed",
        adapterState: {
          responseId: "resp_failed_outputs_123",
          vendorStatus: "failed",
        },
        outputs: [
          {
            kind: "text",
            title: "Diagnostic echec",
            label: "diagnostic",
            mediaType: "text/plain",
            text: "L'adaptateur a echoue mais a produit un diagnostic utile.",
            summary: "Sortie texte malgre statut failed.",
          },
          {
            kind: "structured",
            title: "Contexte echec",
            label: "contexte",
            mediaType: "application/json",
            data: {
              status: "failed",
              reason: "provider_error",
            },
            summary: "Contexte JSON du failed.",
          },
        ],
      }),
    }),
  });

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticket.id,
  ]);

  assert.equal(runResult.exitCode, 0);

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticket.id);
  const journal = await readJournal(rootDir);
  const projection = await readJson<ArtifactIndexProjection>(
    path.join(rootDir, ".corp", "projections", "artifact-index.json"),
  );

  assert.equal(updatedMission.status, "failed");
  assert.equal(updatedTicket.status, "failed");
  assert.equal(updatedMission.artifactIds.length, 2);
  assert.deepEqual(updatedMission.artifactIds, updatedTicket.artifactIds);
  assert.equal(projection.artifacts.length, 2);
  assert.ok(projection.artifacts.every((artifact) => artifact.sourceEventType === "execution.failed"));
  assert.deepEqual(
    journal.filter((event) =>
      event.type === "artifact.detected" || event.type === "artifact.registered"
    ).length,
    4,
  );
});

test("mission artifact list laisse intacte une projection equivalente quand seules les cles JSON changent d'ordre", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-artifact-index-equivalent-projection-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const prepared = await prepareMissionWithArtifacts(rootDir);
  const artifactIndexPath = path.join(rootDir, ".corp", "projections", "artifact-index.json");
  const originalProjection = await readJson<ArtifactIndexProjection>(artifactIndexPath);
  const reorderedProjection = {
    artifacts: originalProjection.artifacts.map((artifact) => ({
      createdAt: artifact.createdAt,
      ticketOwner: artifact.ticketOwner,
      source: artifact.source,
      sourceActor: artifact.sourceActor,
      sourceEventOccurredAt: artifact.sourceEventOccurredAt,
      sourceEventType: artifact.sourceEventType,
      sizeBytes: artifact.sizeBytes,
      sha256: artifact.sha256,
      payloadPath: artifact.payloadPath,
      summary: artifact.summary,
      mediaType: artifact.mediaType,
      path: artifact.path,
      label: artifact.label,
      title: artifact.title,
      kind: artifact.kind,
      workspaceIsolationId: artifact.workspaceIsolationId,
      attemptId: artifact.attemptId,
      producingEventId: artifact.producingEventId,
      ticketId: artifact.ticketId,
      missionId: artifact.missionId,
      artifactId: artifact.artifactId,
    })),
    schemaVersion: 1 as const,
  };
  const reorderedProjectionJson = `${JSON.stringify(reorderedProjection, null, 2)}\n`;

  await writeFile(artifactIndexPath, reorderedProjectionJson, "utf8");

  const result = await runCommand([
    "mission",
    "artifact",
    "list",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.equal(await readFile(artifactIndexPath, "utf8"), reorderedProjectionJson);
});

test("mission artifact list, mission artifact show et mission resume reconstruisent artifact-index si la projection est absente ou corrompue", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-artifact-index-rebuild-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const prepared = await prepareMissionWithArtifacts(rootDir);
  const artifactIndexPath = path.join(rootDir, ".corp", "projections", "artifact-index.json");
  const artifactId = prepared.projection.artifacts[0]?.artifactId;

  assert.ok(artifactId, "au moins un artefact doit etre disponible");

  await unlink(artifactIndexPath);

  const listAfterDelete = await runCommand([
    "mission",
    "artifact",
    "list",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);

  assert.equal(listAfterDelete.exitCode, 0);
  assert.match(listAfterDelete.lines.join("\n"), /Artefacts de mission:/);

  await writeFile(artifactIndexPath, "{corrupted", "utf8");

  const showAfterCorruption = await runCommand([
    "mission",
    "artifact",
    "show",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
    "--artifact-id",
    artifactId,
  ]);
  const resumeAfterCorruption = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);

  assert.equal(showAfterCorruption.exitCode, 0);
  assert.equal(resumeAfterCorruption.exitCode, 0);
  assert.match(showAfterCorruption.lines.join("\n"), new RegExp(`Artefact: ${artifactId}`));
  assert.match(resumeAfterCorruption.lines.join("\n"), /Dernier artefact pertinent:/);

  const rebuiltProjection = await readJson<ArtifactIndexProjection>(artifactIndexPath);

  assert.equal(rebuiltProjection.schemaVersion, 1);
  assert.equal(rebuiltProjection.artifacts.length, prepared.projection.artifacts.length);
  assert.ok(
    rebuiltProjection.artifacts.every((artifact) => artifact.missionId === prepared.missionId),
  );
});

test("mission artifact list reconstruit artifact-index meme si mission et ticket ont perdu leurs artifactIds", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-artifact-index-desync-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  const prepared = await prepareMissionWithArtifacts(rootDir);
  const artifactIndexPath = path.join(rootDir, ".corp", "projections", "artifact-index.json");
  const missionPath = path.join(rootDir, ".corp", "missions", prepared.missionId, "mission.json");
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    prepared.missionId,
    "tickets",
    prepared.ticketId,
    "ticket.json",
  );
  const mission = await readMission(rootDir, prepared.missionId);
  const ticket = await readTicket(rootDir, prepared.missionId, prepared.ticketId);

  await writeFile(
    missionPath,
    `${JSON.stringify({ ...mission, artifactIds: [] }, null, 2)}\n`,
    "utf8",
  );
  await writeFile(
    ticketPath,
    `${JSON.stringify({ ...ticket, artifactIds: [] }, null, 2)}\n`,
    "utf8",
  );
  await unlink(artifactIndexPath);

  const result = await runCommand([
    "mission",
    "artifact",
    "list",
    "--root",
    rootDir,
    "--mission-id",
    prepared.missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), /Artefacts de mission:/);
  assert.deepEqual((await readMission(rootDir, prepared.missionId)).artifactIds, []);
  assert.deepEqual((await readTicket(rootDir, prepared.missionId, prepared.ticketId)).artifactIds, []);

  const rebuiltProjection = await readJson<ArtifactIndexProjection>(artifactIndexPath);

  assert.deepEqual(
    rebuiltProjection.artifacts.map((artifact) => artifact.artifactId),
    prepared.projection.artifacts.map((artifact) => artifact.artifactId),
  );
});

test("mission ticket run background non terminal ne cree pas d'artefact fantome", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-artifact-index-background-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  await bootstrapWorkspace(rootDir);

  const mission = await createMission(rootDir);
  const ticket = await createTicket(rootDir, mission.id);
  const artifactIndexPath = path.join(rootDir, ".corp", "projections", "artifact-index.json");
  const artifactIndexBefore = await readFile(artifactIndexPath, "utf8");

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "requested",
        adapterState: {
          responseId: "resp_background_no_artifact",
          sequenceNumber: 9,
          vendorStatus: "queued",
          pollCursor: "cursor_background_no_artifact",
        },
      }),
    }),
  });

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    mission.id,
    "--ticket-id",
    ticket.id,
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);
  assert.equal(await readFile(artifactIndexPath, "utf8"), artifactIndexBefore);

  const updatedMission = await readMission(rootDir, mission.id);
  const updatedTicket = await readTicket(rootDir, mission.id, ticket.id);
  const journal = await readJournal(rootDir);

  assert.deepEqual(updatedMission.artifactIds, []);
  assert.deepEqual(updatedTicket.artifactIds, []);
  assert.ok(journal.every((event) => event.type !== "artifact.detected"));
  assert.ok(journal.every((event) => event.type !== "artifact.registered"));
});
