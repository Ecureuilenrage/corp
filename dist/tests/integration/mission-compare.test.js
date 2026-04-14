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
const read_mission_compare_1 = require("../../packages/mission-kernel/src/resume-service/read-mission-compare");
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
async function createMission(rootDir, title = "Mission compare") {
    const result = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        title,
        "--objective",
        "Comparer l'etat observe a l'objectif courant",
        "--success-criterion",
        "Le diagnostic reste explicable",
        "--success-criterion",
        "Seule la branche impactee est relancee",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const missionLine = result.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionLine, "la creation doit retourner un missionId");
    return readMission(rootDir, missionLine.slice("Mission creee: ".length));
}
async function createTicket(rootDir, missionId, input) {
    const args = [
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
        input.goal,
        "--owner",
        input.owner,
        "--success-criterion",
        "Le ticket existe",
    ];
    for (const dependencyId of input.dependsOn ?? []) {
        args.push("--depends-on", dependencyId);
    }
    const result = await runCommand(args);
    strict_1.default.equal(result.exitCode, 0);
    const ticketLine = result.lines.find((line) => line.startsWith("Ticket cree: "));
    strict_1.default.ok(ticketLine, "la creation doit retourner un ticketId");
    return ticketLine.slice("Ticket cree: ".length);
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
async function listAttemptIds(rootDir, missionId, ticketId) {
    const attemptsDir = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "attempts");
    try {
        return await (0, promises_1.readdir)(attemptsDir);
    }
    catch (error) {
        if (typeof error === "object"
            && error !== null
            && "code" in error
            && error.code === "ENOENT") {
            return [];
        }
        throw error;
    }
}
(0, node_test_1.default)("mission compare derive un diagnostic failed deterministe et reste read-only", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-compare-failed-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => {
                throw new Error("adapter boom");
            },
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission compare failed");
    const rootTicketId = await createTicket(rootDir, mission.id, {
        goal: "Corriger la branche impactee",
        owner: "agent_root",
    });
    const descendantTicketId = await createTicket(rootDir, mission.id, {
        goal: "Publier apres correction",
        owner: "agent_publish",
        dependsOn: [rootTicketId],
    });
    const unaffectedTicketId = await createTicket(rootDir, mission.id, {
        goal: "Documenter sans dependance",
        owner: "agent_docs",
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
        rootTicketId,
    ]);
    strict_1.default.equal(runResult.exitCode, 1);
    strict_1.default.equal(runResult.lines.at(-1), "adapter boom");
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const journalBeforeCompare = await (0, promises_1.readFile)(journalPath, "utf8");
    const compareResult = await (0, read_mission_compare_1.readMissionCompare)({
        rootDir,
        missionId: mission.id,
    });
    const compareCommand = await runCommand([
        "mission",
        "compare",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const compareOutput = compareCommand.lines.join("\n");
    strict_1.default.equal(compareResult.compare.observed.missionStatus, "failed");
    strict_1.default.equal(compareResult.compare.observed.pendingApprovalCount, 0);
    strict_1.default.deepEqual(compareResult.compare.observed.openTicketIds, [
        descendantTicketId,
        unaffectedTicketId,
    ]);
    strict_1.default.equal(compareResult.compare.impactedBranch.rootTicketId, rootTicketId);
    strict_1.default.deepEqual(compareResult.compare.impactedBranch.impactedTicketIds, [
        rootTicketId,
        descendantTicketId,
    ]);
    strict_1.default.equal(compareResult.compare.impactedBranch.relaunchable, true);
    strict_1.default.equal(compareResult.compare.operatorValidationRequired, false);
    strict_1.default.match(JSON.stringify(compareResult.compare.gaps), new RegExp(rootTicketId));
    strict_1.default.doesNotMatch(JSON.stringify(compareResult.compare), /responseId|pollCursor|vendorStatus|threadId|requires_action/i);
    strict_1.default.equal(compareCommand.exitCode, 0);
    strict_1.default.match(compareOutput, /Attendu:/);
    strict_1.default.match(compareOutput, /Observe:/);
    strict_1.default.match(compareOutput, /Ecarts:/);
    strict_1.default.match(compareOutput, /Branche impactee:/);
    strict_1.default.match(compareOutput, new RegExp(`Racine: ${rootTicketId} \\| relaunchable=oui`));
    strict_1.default.match(compareOutput, new RegExp(`Descendants impactes: ${descendantTicketId}`));
    strict_1.default.match(compareOutput, new RegExp(`Tickets non impactes: ${unaffectedTicketId}`));
    strict_1.default.doesNotMatch(compareOutput, /responseId|pollCursor|vendorStatus|requires_action/i);
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), journalBeforeCompare);
});
(0, node_test_1.default)("mission compare reconstruit ticket-board et resume-view corrompus sans muter le journal", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-compare-rebuild-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => {
                throw new Error("adapter boom");
            },
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission compare rebuild");
    const rootTicketId = await createTicket(rootDir, mission.id, {
        goal: "Racine a faire echouer",
        owner: "agent_root",
    });
    await createTicket(rootDir, mission.id, {
        goal: "Descendant impacte",
        owner: "agent_dep",
        dependsOn: [rootTicketId],
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
        rootTicketId,
    ]);
    strict_1.default.equal(runResult.exitCode, 1);
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const journalBeforeCompare = await (0, promises_1.readFile)(journalPath, "utf8");
    await (0, promises_1.writeFile)(ticketBoardPath, "{corrupted", "utf8");
    await (0, promises_1.writeFile)(resumeViewPath, "{corrupted", "utf8");
    const compareResult = await (0, read_mission_compare_1.readMissionCompare)({
        rootDir,
        missionId: mission.id,
    });
    const compareCommand = await runCommand([
        "mission",
        "compare",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(compareResult.reconstructed, true);
    strict_1.default.equal(compareResult.compare.impactedBranch.rootTicketId, rootTicketId);
    strict_1.default.equal(compareCommand.exitCode, 0);
    strict_1.default.deepEqual(Object.keys(await readJson(ticketBoardPath)), ["schemaVersion", "tickets"]);
    strict_1.default.deepEqual(Object.keys(await readJson(resumeViewPath)), ["schemaVersion", "resume"]);
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), journalBeforeCompare);
});
(0, node_test_1.default)("mission compare rend visible une approval pending mais interdit la relance ciblee tant qu'elle n'est pas resolue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-compare-approval-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_compare_approval",
                    pollCursor: "cursor_compare_approval",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation compare",
                    actionType: "workspace_write",
                    actionSummary: "Modification sensible",
                    guardrails: ["manual_review: workspace_write"],
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission compare approval");
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Attendre une validation explicite",
        owner: "agent_approval",
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
        ticketId,
        "--background",
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    const compareResult = await (0, read_mission_compare_1.readMissionCompare)({
        rootDir,
        missionId: mission.id,
    });
    const compareCommand = await runCommand([
        "mission",
        "compare",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const journalBeforeRelaunch = await (0, promises_1.readFile)(journalPath, "utf8");
    const relaunchResult = await runCommand([
        "mission",
        "compare",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
    ]);
    strict_1.default.equal(compareResult.compare.observed.pendingApprovalCount, 1);
    strict_1.default.equal(compareResult.compare.impactedBranch.rootTicketId, ticketId);
    strict_1.default.equal(compareResult.compare.impactedBranch.relaunchable, false);
    strict_1.default.equal(compareResult.compare.impactedBranch.blockingReasons[0]?.code, "approval_pending");
    strict_1.default.equal(compareResult.compare.operatorValidationRequired, false);
    strict_1.default.doesNotMatch(JSON.stringify(compareResult.compare), /resp_compare_approval|cursor_compare_approval|vendorStatus|requires_approval/i);
    strict_1.default.equal(compareCommand.exitCode, 0);
    strict_1.default.match(compareCommand.lines.join("\n"), /Blocages restants: .*attend encore une approbation/);
    strict_1.default.doesNotMatch(compareCommand.lines.join("\n"), /resp_compare_approval|cursor_compare_approval|vendorStatus|requires_approval/i);
    strict_1.default.equal(relaunchResult.exitCode, 1);
    strict_1.default.match(relaunchResult.lines.at(-1) ?? "", new RegExp(`Le ticket \`${ticketId}\` attend encore une approbation`));
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), journalBeforeRelaunch);
});
(0, node_test_1.default)("mission compare relaunch refuse un descendant et guide vers la vraie racine amont", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-compare-descendant-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => {
                throw new Error("adapter boom");
            },
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission compare descendant");
    const rootTicketId = await createTicket(rootDir, mission.id, {
        goal: "Racine a relancer",
        owner: "agent_root",
    });
    const descendantTicketId = await createTicket(rootDir, mission.id, {
        goal: "Descendant en attente de la racine",
        owner: "agent_child",
        dependsOn: [rootTicketId],
    });
    const firstRun = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        rootTicketId,
    ]);
    strict_1.default.equal(firstRun.exitCode, 1);
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const journalBeforeRelaunch = await (0, promises_1.readFile)(journalPath, "utf8");
    const relaunchResult = await runCommand([
        "mission",
        "compare",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        descendantTicketId,
    ]);
    strict_1.default.equal(relaunchResult.exitCode, 1);
    strict_1.default.match(relaunchResult.lines.at(-1) ?? "", new RegExp(`Relancez d'abord la racine amont \`${rootTicketId}\``));
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), journalBeforeRelaunch);
});
(0, node_test_1.default)("mission compare demande une validation operateur quand tous les tickets sont done sans declarer les criteres satisfaits", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-compare-validation-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "completed",
                adapterState: {
                    responseId: "resp_compare_done",
                    pollCursor: "cursor_compare_done",
                    vendorStatus: "completed",
                },
            }),
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission compare validation");
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Terminer la mission",
        owner: "agent_done",
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
        ticketId,
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    const compareResult = await (0, read_mission_compare_1.readMissionCompare)({
        rootDir,
        missionId: mission.id,
    });
    const compareCommand = await runCommand([
        "mission",
        "compare",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    const output = compareCommand.lines.join("\n");
    strict_1.default.equal(compareResult.compare.operatorValidationRequired, true);
    strict_1.default.equal(compareResult.compare.impactedBranch.rootTicketId, null);
    strict_1.default.equal(compareResult.compare.impactedBranch.relaunchable, false);
    strict_1.default.match(JSON.stringify(compareResult.compare.gaps), /validation_operateur_requise/);
    strict_1.default.equal(compareCommand.exitCode, 0);
    strict_1.default.match(output, /Validation operateur requise: oui/);
    strict_1.default.doesNotMatch(output, /criteres de succes atteints/i);
    strict_1.default.doesNotMatch(output, /resp_compare_done|cursor_compare_done|vendorStatus/i);
});
(0, node_test_1.default)("mission compare relaunch cree une nouvelle tentative uniquement pour la racine selectionnee", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-compare-rerun-root-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    let launchCount = 0;
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => {
                launchCount += 1;
                if (launchCount === 1) {
                    throw new Error("adapter boom");
                }
                return {
                    status: "completed",
                    adapterState: {
                        responseId: "resp_compare_retry_done",
                        pollCursor: "cursor_compare_retry_done",
                        vendorStatus: "completed",
                    },
                };
            },
        }),
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir, "Mission compare relaunch root");
    const rootTicketId = await createTicket(rootDir, mission.id, {
        goal: "Racine a rejouer",
        owner: "agent_root",
    });
    const descendantTicketId = await createTicket(rootDir, mission.id, {
        goal: "Descendant impacte",
        owner: "agent_child",
        dependsOn: [rootTicketId],
    });
    const unaffectedTicketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket sain",
        owner: "agent_safe",
    });
    const firstRun = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        rootTicketId,
    ]);
    strict_1.default.equal(firstRun.exitCode, 1);
    const descendantBefore = await readTicket(rootDir, mission.id, descendantTicketId);
    const unaffectedBefore = await readTicket(rootDir, mission.id, unaffectedTicketId);
    const descendantAttemptsBefore = await listAttemptIds(rootDir, mission.id, descendantTicketId);
    const unaffectedAttemptsBefore = await listAttemptIds(rootDir, mission.id, unaffectedTicketId);
    const relaunchResult = await runCommand([
        "mission",
        "compare",
        "relaunch",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        rootTicketId,
    ]);
    strict_1.default.equal(relaunchResult.exitCode, 0);
    strict_1.default.equal(launchCount, 2);
    strict_1.default.match(relaunchResult.lines.join("\n"), /Tentative ouverte: attempt_/);
    strict_1.default.doesNotMatch(relaunchResult.lines.join("\n"), /resp_compare_retry_done|cursor_compare_retry_done|vendorStatus/i);
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedRoot = await readTicket(rootDir, mission.id, rootTicketId);
    const updatedDescendant = await readTicket(rootDir, mission.id, descendantTicketId);
    const updatedUnaffected = await readTicket(rootDir, mission.id, unaffectedTicketId);
    const rootAttempts = await listAttemptIds(rootDir, mission.id, rootTicketId);
    const descendantAttempts = await listAttemptIds(rootDir, mission.id, descendantTicketId);
    const unaffectedAttempts = await listAttemptIds(rootDir, mission.id, unaffectedTicketId);
    const journal = await readJournal(rootDir);
    strict_1.default.equal(updatedMission.status, "ready");
    strict_1.default.equal(updatedRoot.status, "done");
    strict_1.default.equal(rootAttempts.length, 2);
    strict_1.default.deepEqual(descendantAttempts, descendantAttemptsBefore);
    strict_1.default.deepEqual(unaffectedAttempts, unaffectedAttemptsBefore);
    strict_1.default.deepEqual(updatedDescendant, descendantBefore);
    strict_1.default.deepEqual(updatedUnaffected, unaffectedBefore);
    strict_1.default.equal(journal.at(-1)?.ticketId, rootTicketId);
    strict_1.default.equal(journal.at(-1)?.type, "execution.completed");
});
