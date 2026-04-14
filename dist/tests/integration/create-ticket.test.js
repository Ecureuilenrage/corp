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
async function createMission(rootDir, title = "Mission ticket") {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        title,
        "--objective",
        "Structurer une delegation explicite",
        "--success-criterion",
        "Chaque ticket reste relancable",
        "--success-criterion",
        "Le resume operateur reste scannable",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    const mission = await readMission(rootDir, line.slice("Mission creee: ".length));
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    await (0, promises_1.writeFile)(missionPath, `${JSON.stringify({
        ...mission,
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: ["pack.core"],
        },
    }, null, 2)}\n`, "utf8");
    return readMission(rootDir, mission.id);
}
async function createTicket(rootDir, missionId, extraArgs = []) {
    return runCommand([
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
        "Livrer la delegation ticket",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket est persiste",
        "--success-criterion",
        "Le resume pointe vers le ticket",
        ...extraArgs,
    ]);
}
async function readMission(rootDir, missionId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json"));
}
async function readTicket(rootDir, missionId, ticketId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"));
}
async function writeMissionStatus(rootDir, missionId, status) {
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json");
    const mission = await readMission(rootDir, missionId);
    await (0, promises_1.writeFile)(missionPath, `${JSON.stringify({ ...mission, status }, null, 2)}\n`, "utf8");
}
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
(0, node_test_1.default)("mission ticket create persiste le ticket, met a jour la mission et rafraichit les projections", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-ticket-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const initialMission = await createMission(rootDir);
    const initialJournal = await readJournal(rootDir);
    const initialEventId = initialJournal.at(-1)?.eventId;
    const artifactIndexPath = node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json");
    const artifactIndexBefore = await (0, promises_1.readFile)(artifactIndexPath, "utf8");
    const artifactIndexMtimeBefore = (await (0, promises_1.stat)(artifactIndexPath)).mtimeMs;
    strict_1.default.ok(initialEventId);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const result = await createTicket(rootDir, initialMission.id, [
        "--allow-capability",
        "fs.read",
        "--allow-capability",
        " fs.read ",
        "--allow-capability",
        "cli.run",
        "--skill-pack",
        "pack.core",
        "--skill-pack",
        " pack.core ",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const createdLine = result.lines.find((line) => line.startsWith("Ticket cree: "));
    strict_1.default.ok(createdLine, "la sortie doit inclure l'identifiant de ticket");
    const ticketId = createdLine.slice("Ticket cree: ".length);
    const ticket = await readTicket(rootDir, initialMission.id, ticketId);
    const updatedMission = await readMission(rootDir, initialMission.id);
    const journal = await readJournal(rootDir);
    const createdEvent = journal.at(-1);
    strict_1.default.ok(createdEvent);
    strict_1.default.match(ticket.id, /^ticket_/);
    strict_1.default.equal(ticket.id, ticketId);
    strict_1.default.equal(ticket.missionId, initialMission.id);
    strict_1.default.equal(ticket.kind, "implement");
    strict_1.default.equal(ticket.goal, "Livrer la delegation ticket");
    strict_1.default.equal(ticket.status, "todo");
    strict_1.default.equal(ticket.owner, "agent_dev");
    strict_1.default.deepEqual(ticket.dependsOn, []);
    strict_1.default.deepEqual(ticket.successCriteria, [
        "Le ticket est persiste",
        "Le resume pointe vers le ticket",
    ]);
    strict_1.default.deepEqual(ticket.allowedCapabilities, ["fs.read", "cli.run"]);
    strict_1.default.deepEqual(ticket.skillPackRefs, ["pack.core"]);
    strict_1.default.equal(ticket.workspaceIsolationId, null);
    strict_1.default.deepEqual(ticket.executionHandle, {
        adapter: "codex_responses",
        adapterState: {},
    });
    strict_1.default.deepEqual(ticket.artifactIds, []);
    strict_1.default.deepEqual(ticket.eventIds, [createdEvent.eventId]);
    strict_1.default.equal(ticket.createdAt, ticket.updatedAt);
    strict_1.default.equal(updatedMission.id, initialMission.id);
    strict_1.default.equal(updatedMission.createdAt, initialMission.createdAt);
    strict_1.default.equal(updatedMission.policyProfileId, initialMission.policyProfileId);
    strict_1.default.equal(updatedMission.status, initialMission.status);
    strict_1.default.deepEqual(updatedMission.artifactIds, initialMission.artifactIds);
    strict_1.default.deepEqual(updatedMission.ticketIds, [ticketId]);
    strict_1.default.deepEqual(updatedMission.eventIds, [initialEventId, createdEvent.eventId]);
    strict_1.default.equal(updatedMission.resumeCursor, createdEvent.eventId);
    strict_1.default.equal(updatedMission.updatedAt, createdEvent.occurredAt);
    strict_1.default.equal(journal.length, 2);
    strict_1.default.equal(createdEvent.type, "ticket.created");
    strict_1.default.equal(createdEvent.missionId, initialMission.id);
    strict_1.default.equal(createdEvent.ticketId, ticketId);
    strict_1.default.equal(createdEvent.actor, "operator");
    strict_1.default.equal(createdEvent.source, "corp-cli");
    strict_1.default.deepEqual(createdEvent.payload, {
        mission: updatedMission,
        ticket,
    });
    const missionStatusProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json"));
    const ticketBoardProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    const resumeViewProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    const artifactIndexAfter = await (0, promises_1.readFile)(artifactIndexPath, "utf8");
    const artifactIndexMtimeAfter = (await (0, promises_1.stat)(artifactIndexPath)).mtimeMs;
    strict_1.default.deepEqual(missionStatusProjection, {
        schemaVersion: 1,
        mission: updatedMission,
    });
    strict_1.default.deepEqual(ticketBoardProjection, {
        schemaVersion: 1,
        tickets: [
            {
                ticketId,
                missionId: initialMission.id,
                title: "Livrer la delegation ticket",
                status: "todo",
                owner: "agent_dev",
                kind: "implement",
                dependsOn: [],
                allowedCapabilities: ["fs.read", "cli.run"],
                skillPackRefs: ["pack.core"],
                usedCapabilities: [],
                usedSkillPacks: [],
                planOrder: 0,
                runnable: true,
                blockedByTicketIds: [],
                planningState: "runnable",
                dependencyStatuses: [],
                trackingState: "runnable",
                statusReasonCode: "runnable",
                blockingReasonCode: null,
                activeAttemptId: null,
                activeAttemptStatus: null,
                lastAttemptId: null,
                lastAttemptStatus: null,
                lastAttemptStartedAt: null,
                lastAttemptEndedAt: null,
                lastAttemptBackgroundRequested: null,
                lastAttemptWorkspaceIsolationId: null,
                updatedAt: ticket.updatedAt,
            },
        ],
    });
    strict_1.default.deepEqual(resumeViewProjection.resume?.openTickets, [
        {
            ticketId,
            missionId: initialMission.id,
            title: "Livrer la delegation ticket",
            status: "todo",
            owner: "agent_dev",
            kind: "implement",
            dependsOn: [],
            allowedCapabilities: ["fs.read", "cli.run"],
            skillPackRefs: ["pack.core"],
            usedCapabilities: [],
            usedSkillPacks: [],
            planOrder: 0,
            runnable: true,
            blockedByTicketIds: [],
            planningState: "runnable",
            dependencyStatuses: [],
            trackingState: "runnable",
            statusReasonCode: "runnable",
            blockingReasonCode: null,
            activeAttemptId: null,
            activeAttemptStatus: null,
            lastAttemptId: null,
            lastAttemptStatus: null,
            lastAttemptStartedAt: null,
            lastAttemptEndedAt: null,
            lastAttemptBackgroundRequested: null,
            lastAttemptWorkspaceIsolationId: null,
            updatedAt: ticket.updatedAt,
        },
    ]);
    strict_1.default.equal(resumeViewProjection.resume?.lastEventId, createdEvent.eventId);
    strict_1.default.equal(resumeViewProjection.resume?.nextOperatorAction, "Traitez le prochain ticket runnable: Livrer la delegation ticket.");
    strict_1.default.equal(artifactIndexAfter, artifactIndexBefore);
    strict_1.default.equal(artifactIndexMtimeAfter, artifactIndexMtimeBefore);
    const output = result.lines.join("\n");
    strict_1.default.match(output, new RegExp(`Ticket cree: ${ticketId}`));
    strict_1.default.match(output, new RegExp(`Mission: ${initialMission.id}`));
    strict_1.default.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
    strict_1.default.match(output, /Prochain arbitrage utile: Traitez le prochain ticket runnable: Livrer la delegation ticket\./);
});
(0, node_test_1.default)("mission ticket create rejette une dependance inconnue et une dependance cross-mission sans muter l'etat", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-ticket-dependencies-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionA = await createMission(rootDir, "Mission A");
    const missionB = await createMission(rootDir, "Mission B");
    const initialJournal = await readJournal(rootDir);
    const missionBTicketResult = await createTicket(rootDir, missionB.id, [
        "--kind",
        "research",
        "--goal",
        "Explorer la mission B",
        "--owner",
        "agent_research",
        "--success-criterion",
        "Le ticket B existe",
    ]);
    strict_1.default.equal(missionBTicketResult.exitCode, 0);
    const ticketBLine = missionBTicketResult.lines.find((line) => line.startsWith("Ticket cree: "));
    strict_1.default.ok(ticketBLine);
    const ticketBId = ticketBLine.slice("Ticket cree: ".length);
    const initialMissionA = await readMission(rootDir, missionA.id);
    const boardBeforeFailures = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    const unknownDependencyResult = await createTicket(rootDir, missionA.id, [
        "--depends-on",
        "ticket_inconnu",
    ]);
    strict_1.default.equal(unknownDependencyResult.exitCode, 1);
    strict_1.default.equal(unknownDependencyResult.lines.at(-1), `La dependance \`ticket_inconnu\` est introuvable dans la mission \`${missionA.id}\`.`);
    const crossMissionDependencyResult = await createTicket(rootDir, missionA.id, [
        "--depends-on",
        ticketBId,
    ]);
    strict_1.default.equal(crossMissionDependencyResult.exitCode, 1);
    strict_1.default.equal(crossMissionDependencyResult.lines.at(-1), `La dependance \`${ticketBId}\` n'appartient pas a la mission \`${missionA.id}\`.`);
    const finalMissionA = await readMission(rootDir, missionA.id);
    const finalJournal = await readJournal(rootDir);
    const finalBoard = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    strict_1.default.deepEqual(finalMissionA, initialMissionA);
    strict_1.default.equal(finalMissionA.updatedAt, initialMissionA.updatedAt, "missionA.updatedAt ne doit pas changer apres un echec de dependance invalide");
    strict_1.default.equal(finalJournal.length, initialJournal.length + 1);
    strict_1.default.deepEqual(finalBoard, boardBeforeFailures);
});
(0, node_test_1.default)("mission ticket create accepte les missions blocked sans changer leur statut", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-ticket-non-terminal-statuses-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission blocked");
    await writeMissionStatus(rootDir, mission.id, "blocked");
    const missionBefore = await readMission(rootDir, mission.id);
    const ticketResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Creer un ticket sur mission blocked",
        "--owner",
        "agent_blocked",
        "--success-criterion",
        "Le ticket est persiste",
    ]);
    strict_1.default.equal(ticketResult.exitCode, 0, "la creation doit reussir pour blocked");
    const createdLine = ticketResult.lines.find((line) => line.startsWith("Ticket cree: "));
    strict_1.default.ok(createdLine, "la creation doit annoncer le ticket pour blocked");
    const ticketId = createdLine.slice("Ticket cree: ".length);
    const missionAfter = await readMission(rootDir, mission.id);
    const ticket = await readTicket(rootDir, mission.id, ticketId);
    strict_1.default.equal(ticket.missionId, mission.id);
    strict_1.default.equal(ticket.owner, "agent_blocked");
    strict_1.default.equal(missionAfter.status, "blocked");
    strict_1.default.deepEqual(missionAfter.ticketIds, [...missionBefore.ticketIds, ticketId]);
});
(0, node_test_1.default)("mission ticket create refuse les missions failed sans modifier leur historique", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-ticket-failed-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission failed");
    await writeMissionStatus(rootDir, mission.id, "failed");
    const missionBefore = await readMission(rootDir, mission.id);
    const journalBefore = await readJournal(rootDir);
    const ticketResult = await createTicket(rootDir, mission.id, [
        "--goal",
        "Creer un ticket sur mission failed",
        "--owner",
        "agent_failed",
        "--success-criterion",
        "Le ticket est persiste",
    ]);
    strict_1.default.equal(ticketResult.exitCode, 1, "la creation doit echouer pour failed");
    strict_1.default.ok(ticketResult.lines.some((line) => line.includes("statut est terminal")), "le message doit mentionner statut terminal");
    const missionAfter = await readMission(rootDir, mission.id);
    strict_1.default.deepEqual(missionAfter, missionBefore);
    strict_1.default.deepEqual(await readJournal(rootDir), journalBefore);
});
(0, node_test_1.default)("mission ticket create refuse les missions completed ou cancelled sans modifier leur historique", async (t) => {
    const completedRootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-ticket-completed-"));
    const cancelledRootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-ticket-cancelled-"));
    t.after(async () => {
        await (0, promises_1.rm)(completedRootDir, { recursive: true, force: true });
        await (0, promises_1.rm)(cancelledRootDir, { recursive: true, force: true });
    });
    for (const [rootDir, outcome] of [
        [completedRootDir, "completed"],
        [cancelledRootDir, "cancelled"],
    ]) {
        await bootstrapWorkspace(rootDir);
        const mission = await createMission(rootDir, `Mission ${outcome}`);
        const closeResult = await runCommand([
            "mission",
            "close",
            "--root",
            rootDir,
            "--mission-id",
            mission.id,
            "--outcome",
            outcome,
        ]);
        strict_1.default.equal(closeResult.exitCode, 0);
        const missionBefore = await readMission(rootDir, mission.id);
        const journalBefore = await readJournal(rootDir);
        const ticketResult = await createTicket(rootDir, mission.id);
        strict_1.default.equal(ticketResult.exitCode, 1);
        strict_1.default.equal(ticketResult.lines.at(-1), `Impossible de creer un ticket dans la mission \`${mission.id}\` car son statut est terminal (\`${outcome}\`).`);
        const missionAfter = await readMission(rootDir, mission.id);
        const journalAfter = await readJournal(rootDir);
        strict_1.default.deepEqual(missionAfter, missionBefore);
        strict_1.default.deepEqual(journalAfter, journalBefore);
    }
});
