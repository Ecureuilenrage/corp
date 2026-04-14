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
async function createMission(rootDir) {
    const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(bootstrapResult.exitCode, 0);
    const createResult = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission lifecycle",
        "--objective",
        "Piloter la mission sans perdre son historique",
        "--success-criterion",
        "Les transitions restent auditable",
        "--success-criterion",
        "Le resume operateur reste coherent",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const missionCreatedLine = createResult.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionCreatedLine, "la creation doit retourner un missionId");
    return {
        missionId: missionCreatedLine.slice("Mission creee: ".length),
    };
}
async function readMission(rootDir, missionId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json"));
}
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
function assertLifecycleOutput(output, missionId, status) {
    strict_1.default.match(output, new RegExp(`Mission: ${missionId}`));
    strict_1.default.match(output, new RegExp(`Statut: ${status}`));
}
(0, node_test_1.default)("les transitions lifecycle appendent le journal et preservent le snapshot mission", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const createdMission = await readMission(rootDir, missionId);
    const initialCreatedAt = createdMission.createdAt;
    const initialPolicyProfileId = createdMission.policyProfileId;
    const initialTicketIds = [...createdMission.ticketIds];
    const initialArtifactIds = [...createdMission.artifactIds];
    const pauseResult = await runCommand([
        "mission",
        "pause",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(pauseResult.exitCode, 0);
    assertLifecycleOutput(pauseResult.lines.join("\n"), missionId, "blocked");
    strict_1.default.match(pauseResult.lines.join("\n"), /Prochain arbitrage utile: Mission bloquee\. Relancez-la quand les conditions de reprise sont reunies\./);
    const pausedMission = await readMission(rootDir, missionId);
    const pauseJournal = await readJournal(rootDir);
    const pauseEvent = pauseJournal.at(-1);
    strict_1.default.ok(pauseEvent);
    strict_1.default.equal(pausedMission.status, "blocked");
    strict_1.default.equal(pausedMission.createdAt, initialCreatedAt);
    strict_1.default.equal(pausedMission.policyProfileId, initialPolicyProfileId);
    strict_1.default.deepEqual(pausedMission.ticketIds, initialTicketIds);
    strict_1.default.deepEqual(pausedMission.artifactIds, initialArtifactIds);
    strict_1.default.equal(pausedMission.resumeCursor, pauseEvent.eventId);
    strict_1.default.equal(pausedMission.updatedAt, pauseEvent.occurredAt);
    strict_1.default.deepEqual(pausedMission.eventIds, pauseJournal.map((event) => event.eventId));
    strict_1.default.equal(pauseEvent.type, "mission.paused");
    strict_1.default.equal(pauseEvent.payload.previousStatus, "ready");
    strict_1.default.equal(pauseEvent.payload.nextStatus, "blocked");
    strict_1.default.equal(pauseEvent.payload.trigger, "operator");
    strict_1.default.deepEqual(pauseEvent.payload.mission, pausedMission);
    const pausedMissionStatusProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json"));
    const pausedResumeViewProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    strict_1.default.deepEqual(pausedMissionStatusProjection, {
        schemaVersion: 1,
        mission: pausedMission,
    });
    strict_1.default.equal(pausedResumeViewProjection.resume?.status, "blocked");
    strict_1.default.equal(pausedResumeViewProjection.resume?.lastEventId, pauseEvent.eventId);
    strict_1.default.equal(pausedResumeViewProjection.resume?.nextOperatorAction, "Mission bloquee. Relancez-la quand les conditions de reprise sont reunies.");
    const relaunchResult = await runCommand([
        "mission",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(relaunchResult.exitCode, 0);
    assertLifecycleOutput(relaunchResult.lines.join("\n"), missionId, "ready");
    strict_1.default.match(relaunchResult.lines.join("\n"), /Prochain arbitrage utile: Aucun ticket n'existe encore\./);
    const relaunchedMission = await readMission(rootDir, missionId);
    const relaunchJournal = await readJournal(rootDir);
    const relaunchEvent = relaunchJournal.at(-1);
    strict_1.default.ok(relaunchEvent);
    strict_1.default.equal(relaunchedMission.status, "ready");
    strict_1.default.equal(relaunchedMission.createdAt, initialCreatedAt);
    strict_1.default.equal(relaunchedMission.resumeCursor, relaunchEvent.eventId);
    strict_1.default.equal(relaunchedMission.updatedAt, relaunchEvent.occurredAt);
    strict_1.default.deepEqual(relaunchedMission.eventIds, relaunchJournal.map((event) => event.eventId));
    strict_1.default.equal(relaunchEvent.type, "mission.relaunched");
    strict_1.default.equal(relaunchEvent.payload.previousStatus, "blocked");
    strict_1.default.equal(relaunchEvent.payload.nextStatus, "ready");
    strict_1.default.deepEqual(relaunchEvent.payload.mission, relaunchedMission);
    const closeResult = await runCommand([
        "mission",
        "close",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--outcome",
        "completed",
    ]);
    strict_1.default.equal(closeResult.exitCode, 0);
    assertLifecycleOutput(closeResult.lines.join("\n"), missionId, "completed");
    strict_1.default.match(closeResult.lines.join("\n"), /Prochain arbitrage utile: Mission terminee\. Aucun arbitrage supplementaire n'est requis\./);
    const completedMission = await readMission(rootDir, missionId);
    const closeJournal = await readJournal(rootDir);
    const closeEvent = closeJournal.at(-1);
    strict_1.default.ok(closeEvent);
    strict_1.default.equal(completedMission.status, "completed");
    strict_1.default.equal(completedMission.createdAt, initialCreatedAt);
    strict_1.default.equal(completedMission.resumeCursor, closeEvent.eventId);
    strict_1.default.equal(completedMission.updatedAt, closeEvent.occurredAt);
    strict_1.default.deepEqual(completedMission.eventIds, closeJournal.map((event) => event.eventId));
    strict_1.default.equal(closeEvent.type, "mission.completed");
    strict_1.default.equal(closeEvent.payload.previousStatus, "ready");
    strict_1.default.equal(closeEvent.payload.nextStatus, "completed");
    strict_1.default.deepEqual(closeEvent.payload.mission, completedMission);
    const completedResumeViewProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    strict_1.default.equal(completedResumeViewProjection.resume?.status, "completed");
    strict_1.default.equal(completedResumeViewProjection.resume?.lastEventId, closeEvent.eventId);
    strict_1.default.equal(completedResumeViewProjection.resume?.nextOperatorAction, "Mission terminee. Aucun arbitrage supplementaire n'est requis.");
});
(0, node_test_1.default)("mission close --outcome cancelled place la mission dans un etat terminal conforme", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-cancelled-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const result = await runCommand([
        "mission",
        "close",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--outcome",
        "cancelled",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    assertLifecycleOutput(result.lines.join("\n"), missionId, "cancelled");
    const mission = await readMission(rootDir, missionId);
    const journal = await readJournal(rootDir);
    const lastEvent = journal.at(-1);
    strict_1.default.ok(lastEvent);
    strict_1.default.equal(mission.status, "cancelled");
    strict_1.default.equal(mission.resumeCursor, lastEvent.eventId);
    strict_1.default.equal(lastEvent.type, "mission.cancelled");
    strict_1.default.equal(lastEvent.payload.previousStatus, "ready");
    strict_1.default.equal(lastEvent.payload.nextStatus, "cancelled");
    strict_1.default.equal(result.lines.at(-1), "Prochain arbitrage utile: Mission annulee. Aucun arbitrage supplementaire n'est requis.");
});
(0, node_test_1.default)("les transitions interdites apres un etat terminal echouent explicitement", async (t) => {
    const completedRootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-completed-"));
    const cancelledRootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-cancelled-terminal-"));
    t.after(async () => {
        await (0, promises_1.rm)(completedRootDir, { recursive: true, force: true });
        await (0, promises_1.rm)(cancelledRootDir, { recursive: true, force: true });
    });
    const { missionId: completedMissionId } = await createMission(completedRootDir);
    const { missionId: cancelledMissionId } = await createMission(cancelledRootDir);
    const closeCompletedResult = await runCommand([
        "mission",
        "close",
        "--root",
        completedRootDir,
        "--mission-id",
        completedMissionId,
        "--outcome",
        "completed",
    ]);
    const closeCancelledResult = await runCommand([
        "mission",
        "close",
        "--root",
        cancelledRootDir,
        "--mission-id",
        cancelledMissionId,
        "--outcome",
        "cancelled",
    ]);
    strict_1.default.equal(closeCompletedResult.exitCode, 0);
    strict_1.default.equal(closeCancelledResult.exitCode, 0);
    const relaunchAfterCompleted = await runCommand([
        "mission",
        "relaunch",
        "--root",
        completedRootDir,
        "--mission-id",
        completedMissionId,
    ]);
    const pauseAfterCancelled = await runCommand([
        "mission",
        "pause",
        "--root",
        cancelledRootDir,
        "--mission-id",
        cancelledMissionId,
    ]);
    strict_1.default.equal(relaunchAfterCompleted.exitCode, 1);
    strict_1.default.equal(relaunchAfterCompleted.lines.at(-1), "La transition `relaunch` est interdite depuis le statut `completed`.");
    strict_1.default.equal(pauseAfterCancelled.exitCode, 1);
    strict_1.default.equal(pauseAfterCancelled.lines.at(-1), "La transition `pause` est interdite depuis le statut `cancelled`.");
});
(0, node_test_1.default)("pause sur une mission deja blocked echoue explicitement", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-pause-blocked-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const pauseResult = await runCommand([
        "mission",
        "pause",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(pauseResult.exitCode, 0);
    assertLifecycleOutput(pauseResult.lines.join("\n"), missionId, "blocked");
    const doublePauseResult = await runCommand([
        "mission",
        "pause",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(doublePauseResult.exitCode, 1);
    strict_1.default.equal(doublePauseResult.lines.at(-1), "La transition `pause` est interdite depuis le statut `blocked`.");
});
(0, node_test_1.default)("relaunch sur une mission deja ready echoue explicitement", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-relaunch-ready-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const relaunchResult = await runCommand([
        "mission",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(relaunchResult.exitCode, 1);
    strict_1.default.equal(relaunchResult.lines.at(-1), "La transition `relaunch` est interdite depuis le statut `ready`.");
});
(0, node_test_1.default)("toutes les transitions sont interdites depuis les etats terminaux", async (t) => {
    const completedRootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-terminal-completed-"));
    const cancelledRootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-lifecycle-terminal-cancelled-"));
    t.after(async () => {
        await (0, promises_1.rm)(completedRootDir, { recursive: true, force: true });
        await (0, promises_1.rm)(cancelledRootDir, { recursive: true, force: true });
    });
    const { missionId: completedMissionId } = await createMission(completedRootDir);
    const { missionId: cancelledMissionId } = await createMission(cancelledRootDir);
    await runCommand(["mission", "close", "--root", completedRootDir, "--mission-id", completedMissionId, "--outcome", "completed"]);
    await runCommand(["mission", "close", "--root", cancelledRootDir, "--mission-id", cancelledMissionId, "--outcome", "cancelled"]);
    const cases = [
        { rootDir: completedRootDir, missionId: completedMissionId, action: "pause", status: "completed" },
        { rootDir: completedRootDir, missionId: completedMissionId, action: "relaunch", status: "completed" },
        { rootDir: completedRootDir, missionId: completedMissionId, action: "close", status: "completed", extra: ["--outcome", "completed"] },
        { rootDir: cancelledRootDir, missionId: cancelledMissionId, action: "pause", status: "cancelled" },
        { rootDir: cancelledRootDir, missionId: cancelledMissionId, action: "relaunch", status: "cancelled" },
        { rootDir: cancelledRootDir, missionId: cancelledMissionId, action: "close", status: "cancelled", extra: ["--outcome", "cancelled"] },
    ];
    for (const testCase of cases) {
        const args = [
            "mission",
            testCase.action,
            "--root",
            testCase.rootDir,
            "--mission-id",
            testCase.missionId,
            ...(testCase.extra ?? []),
        ];
        const result = await runCommand(args);
        strict_1.default.equal(result.exitCode, 1, `${testCase.action} apres ${testCase.status} devrait echouer`);
        strict_1.default.equal(result.lines.at(-1), `La transition \`${testCase.action}\` est interdite depuis le statut \`${testCase.status}\`.`, `message inattendu pour ${testCase.action} apres ${testCase.status}`);
    }
});
