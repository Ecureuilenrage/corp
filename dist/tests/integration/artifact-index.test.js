"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = require("node:os");
const node_test_1 = __importDefault(require("node:test"));
const index_1 = require("../../apps/corp-cli/src/index");
const run_ticket_1 = require("../../packages/ticket-runtime/src/ticket-service/run-ticket");
async function runCommand(args) {
    const lines = [];
    const exitCode = await (0, index_1.runCli)(args, {
        writeLine: (line) => lines.push(line),
    });
    return {
        exitCode,
        lines,
    };
}
async function readJson(filePath) {
    return JSON.parse(await (0, promises_1.readFile)(filePath, "utf8"));
}
async function bootstrapWorkspace(rootDir) {
    const result = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(result.exitCode, 0);
}
async function createMission(rootDir) {
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
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", line.slice("Mission creee: ".length), "mission.json"));
}
async function createTicket(rootDir, missionId) {
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
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
    strict_1.default.ok(line, "la creation doit retourner un ticketId");
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", line.slice("Ticket cree: ".length), "ticket.json"));
}
async function readMission(rootDir, missionId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json"));
}
async function readTicket(rootDir, missionId, ticketId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"));
}
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
async function prepareMissionWithArtifacts(rootDir) {
    await bootstrapWorkspace(rootDir);
    await (0, promises_1.writeFile)(node_path_1.default.join(rootDir, "README.md"), "README initial\n", "utf8");
    const mission = await createMission(rootDir);
    const ticket = await createTicket(rootDir, mission.id);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async ({ workspacePath }) => {
                await (0, promises_1.writeFile)(node_path_1.default.join(workspacePath, "README.md"), "README modifie\n", "utf8");
                await (0, promises_1.mkdir)(node_path_1.default.join(workspacePath, "bin"), { recursive: true });
                await (0, promises_1.writeFile)(node_path_1.default.join(workspacePath, "bin", "payload.bin"), Buffer.from([0, 1, 2, 3, 4, 5]));
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
    strict_1.default.equal(runResult.exitCode, 0);
    const attemptLine = runResult.lines.find((line) => line.startsWith("Tentative ouverte: "));
    strict_1.default.ok(attemptLine, "la commande doit annoncer l'attempt");
    const projection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json"));
    return {
        missionId: mission.id,
        ticketId: ticket.id,
        attemptId: attemptLine.slice("Tentative ouverte: ".length),
        projection,
    };
}
(0, node_test_1.default)("mission ticket run foreground enregistre plusieurs artefacts et expose une navigation mission-centrique sans fuite vendor", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-artifact-index-foreground-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
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
    strict_1.default.ok(executionCompletedEvent, "un evenement terminal doit exister");
    strict_1.default.equal(prepared.projection.schemaVersion, 1);
    strict_1.default.equal(prepared.projection.artifacts.length, 4);
    strict_1.default.equal(updatedMission.artifactIds.length, 4);
    strict_1.default.deepEqual(updatedMission.artifactIds, updatedTicket.artifactIds);
    for (const artifact of prepared.projection.artifacts) {
        strict_1.default.equal(artifact.missionId, prepared.missionId);
        strict_1.default.equal(artifact.ticketId, prepared.ticketId);
        strict_1.default.equal(artifact.attemptId, prepared.attemptId);
        strict_1.default.ok(artifact.workspaceIsolationId);
        strict_1.default.equal(artifact.producingEventId, executionCompletedEvent.eventId);
        strict_1.default.equal(artifact.sourceEventType, "execution.completed");
        strict_1.default.equal(artifact.sourceActor, "adapter");
        strict_1.default.equal(typeof artifact.createdAt, "string");
    }
    const workspaceArtifacts = prepared.projection.artifacts.filter((artifact) => artifact.kind === "workspace_file");
    strict_1.default.equal(workspaceArtifacts.length, 2);
    strict_1.default.ok(workspaceArtifacts.some((artifact) => artifact.path === "README.md"));
    strict_1.default.ok(workspaceArtifacts.some((artifact) => artifact.path === "bin/payload.bin"));
    strict_1.default.ok(workspaceArtifacts.every((artifact) => typeof artifact.sha256 === "string"));
    strict_1.default.ok(workspaceArtifacts.every((artifact) => typeof artifact.sizeBytes === "number"));
    const adapterTextArtifact = prepared.projection.artifacts.find((artifact) => artifact.kind === "report_text");
    strict_1.default.ok(adapterTextArtifact);
    strict_1.default.ok(adapterTextArtifact.payloadPath);
    const adapterStructuredArtifact = prepared.projection.artifacts.find((artifact) => artifact.kind === "structured_output");
    strict_1.default.ok(adapterStructuredArtifact);
    strict_1.default.ok(adapterStructuredArtifact.payloadPath);
    const artifactEvents = journal.filter((event) => event.type === "artifact.detected" || event.type === "artifact.registered");
    strict_1.default.equal(artifactEvents.length, 8);
    strict_1.default.ok(artifactEvents.every((event) => event.attemptId === prepared.attemptId));
    strict_1.default.equal(listResult.exitCode, 0);
    strict_1.default.match(listResult.lines.join("\n"), /Artefacts de mission:/);
    strict_1.default.match(listResult.lines.join("\n"), new RegExp(prepared.ticketId));
    strict_1.default.match(listResult.lines.join("\n"), /kind=workspace_file/);
    strict_1.default.match(listResult.lines.join("\n"), /kind=report_text/);
    strict_1.default.match(listResult.lines.join("\n"), /kind=structured_output/);
    strict_1.default.doesNotMatch(listResult.lines.join("\n"), /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i);
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
    strict_1.default.equal(showResult.exitCode, 0);
    strict_1.default.match(showResult.lines.join("\n"), new RegExp(`Mission: ${prepared.missionId}`));
    strict_1.default.match(showResult.lines.join("\n"), new RegExp(`Ticket: ${prepared.ticketId}`));
    strict_1.default.match(showResult.lines.join("\n"), new RegExp(`Artefact: ${adapterTextArtifact.artifactId}`));
    strict_1.default.match(showResult.lines.join("\n"), /Type source: execution.completed/);
    strict_1.default.match(showResult.lines.join("\n"), /Acteur: adapter/);
    strict_1.default.match(showResult.lines.join("\n"), /Preview:/);
    strict_1.default.match(showResult.lines.join("\n"), /Synthese utile pour l'operateur/);
    strict_1.default.doesNotMatch(showResult.lines.join("\n"), /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(resumeResult.lines.join("\n"), /Dernier artefact pertinent: (Synthese operateur|README\.md|Rapport structure|payload\.bin)/);
    strict_1.default.doesNotMatch(resumeResult.lines.join("\n"), /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i);
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.match(statusResult.lines.join("\n"), /Dernier artefact pertinent: /);
    strict_1.default.doesNotMatch(statusResult.lines.join("\n"), /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor/i);
    const artifactIndexRaw = await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json"), "utf8");
    strict_1.default.doesNotMatch(artifactIndexRaw, /responseId|resp_artifact_123|sequenceNumber|vendorStatus|pollCursor|structure exploitable cote corp.*response/i);
});
(0, node_test_1.default)("mission ticket run foreground avec status failed et outputs enregistre quand meme les artefacts", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-artifact-index-failed-outputs-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticket = await createTicket(rootDir, mission.id);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
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
    strict_1.default.equal(runResult.exitCode, 0);
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticket.id);
    const journal = await readJournal(rootDir);
    const projection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json"));
    strict_1.default.equal(updatedMission.status, "failed");
    strict_1.default.equal(updatedTicket.status, "failed");
    strict_1.default.equal(updatedMission.artifactIds.length, 2);
    strict_1.default.deepEqual(updatedMission.artifactIds, updatedTicket.artifactIds);
    strict_1.default.equal(projection.artifacts.length, 2);
    strict_1.default.ok(projection.artifacts.every((artifact) => artifact.sourceEventType === "execution.failed"));
    strict_1.default.deepEqual(journal.filter((event) => event.type === "artifact.detected" || event.type === "artifact.registered").length, 4);
});
(0, node_test_1.default)("mission artifact list laisse intacte une projection equivalente quand seules les cles JSON changent d'ordre", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-artifact-index-equivalent-projection-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const prepared = await prepareMissionWithArtifacts(rootDir);
    const artifactIndexPath = node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json");
    const originalProjection = await readJson(artifactIndexPath);
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
        schemaVersion: 1,
    };
    const reorderedProjectionJson = `${JSON.stringify(reorderedProjection, null, 2)}\n`;
    await (0, promises_1.writeFile)(artifactIndexPath, reorderedProjectionJson, "utf8");
    const result = await runCommand([
        "mission",
        "artifact",
        "list",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.equal(await (0, promises_1.readFile)(artifactIndexPath, "utf8"), reorderedProjectionJson);
});
(0, node_test_1.default)("mission artifact list, mission artifact show et mission resume reconstruisent artifact-index si la projection est absente ou corrompue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-artifact-index-rebuild-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const prepared = await prepareMissionWithArtifacts(rootDir);
    const artifactIndexPath = node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json");
    const artifactId = prepared.projection.artifacts[0]?.artifactId;
    strict_1.default.ok(artifactId, "au moins un artefact doit etre disponible");
    await (0, promises_1.unlink)(artifactIndexPath);
    const listAfterDelete = await runCommand([
        "mission",
        "artifact",
        "list",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
    ]);
    strict_1.default.equal(listAfterDelete.exitCode, 0);
    strict_1.default.match(listAfterDelete.lines.join("\n"), /Artefacts de mission:/);
    await (0, promises_1.writeFile)(artifactIndexPath, "{corrupted", "utf8");
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
    strict_1.default.equal(showAfterCorruption.exitCode, 0);
    strict_1.default.equal(resumeAfterCorruption.exitCode, 0);
    strict_1.default.match(showAfterCorruption.lines.join("\n"), new RegExp(`Artefact: ${artifactId}`));
    strict_1.default.match(resumeAfterCorruption.lines.join("\n"), /Dernier artefact pertinent:/);
    const rebuiltProjection = await readJson(artifactIndexPath);
    strict_1.default.equal(rebuiltProjection.schemaVersion, 1);
    strict_1.default.equal(rebuiltProjection.artifacts.length, prepared.projection.artifacts.length);
    strict_1.default.ok(rebuiltProjection.artifacts.every((artifact) => artifact.missionId === prepared.missionId));
});
(0, node_test_1.default)("mission artifact list reconstruit artifact-index meme si mission et ticket ont perdu leurs artifactIds", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-artifact-index-desync-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const prepared = await prepareMissionWithArtifacts(rootDir);
    const artifactIndexPath = node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json");
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", prepared.missionId, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", prepared.missionId, "tickets", prepared.ticketId, "ticket.json");
    const mission = await readMission(rootDir, prepared.missionId);
    const ticket = await readTicket(rootDir, prepared.missionId, prepared.ticketId);
    await (0, promises_1.writeFile)(missionPath, `${JSON.stringify({ ...mission, artifactIds: [] }, null, 2)}\n`, "utf8");
    await (0, promises_1.writeFile)(ticketPath, `${JSON.stringify({ ...ticket, artifactIds: [] }, null, 2)}\n`, "utf8");
    await (0, promises_1.unlink)(artifactIndexPath);
    const result = await runCommand([
        "mission",
        "artifact",
        "list",
        "--root",
        rootDir,
        "--mission-id",
        prepared.missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), /Artefacts de mission:/);
    strict_1.default.deepEqual((await readMission(rootDir, prepared.missionId)).artifactIds, []);
    strict_1.default.deepEqual((await readTicket(rootDir, prepared.missionId, prepared.ticketId)).artifactIds, []);
    const rebuiltProjection = await readJson(artifactIndexPath);
    strict_1.default.deepEqual(rebuiltProjection.artifacts.map((artifact) => artifact.artifactId), prepared.projection.artifacts.map((artifact) => artifact.artifactId));
});
(0, node_test_1.default)("mission ticket run background non terminal ne cree pas d'artefact fantome", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-artifact-index-background-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticket = await createTicket(rootDir, mission.id);
    const artifactIndexPath = node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json");
    const artifactIndexBefore = await (0, promises_1.readFile)(artifactIndexPath, "utf8");
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
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
    strict_1.default.equal(runResult.exitCode, 0);
    strict_1.default.equal(await (0, promises_1.readFile)(artifactIndexPath, "utf8"), artifactIndexBefore);
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicket = await readTicket(rootDir, mission.id, ticket.id);
    const journal = await readJournal(rootDir);
    strict_1.default.deepEqual(updatedMission.artifactIds, []);
    strict_1.default.deepEqual(updatedTicket.artifactIds, []);
    strict_1.default.ok(journal.every((event) => event.type !== "artifact.detected"));
    strict_1.default.ok(journal.every((event) => event.type !== "artifact.registered"));
});
