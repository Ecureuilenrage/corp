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
const update_ticket_1 = require("../../packages/ticket-runtime/src/ticket-service/update-ticket");
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
        "Mission replanning",
        "--objective",
        "Faire evoluer un plan ticket sans perdre le resume",
        "--success-criterion",
        "Le plan est reordonnable",
        "--success-criterion",
        "Le runnable set reste deterministe",
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
            skillPackRefs: ["pack.plan", "pack.audit"],
        },
    }, null, 2)}\n`, "utf8");
    return readMission(rootDir, mission.id);
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
        input.kind ?? "implement",
        "--goal",
        input.goal,
        "--owner",
        input.owner,
    ];
    for (const successCriterion of input.successCriteria) {
        args.push("--success-criterion", successCriterion);
    }
    for (const dependencyId of input.dependsOn ?? []) {
        args.push("--depends-on", dependencyId);
    }
    for (const allowedCapability of input.allowedCapabilities ?? []) {
        args.push("--allow-capability", allowedCapability);
    }
    for (const skillPackRef of input.skillPackRefs ?? []) {
        args.push("--skill-pack", skillPackRef);
    }
    const result = await runCommand(args);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
    strict_1.default.ok(line, "la creation doit retourner un ticketId");
    return line.slice("Ticket cree: ".length);
}
async function readMission(rootDir, missionId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json"));
}
async function readTicket(rootDir, missionId, ticketId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"));
}
async function writeTicketStatus(rootDir, missionId, ticketId, status) {
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json");
    const ticket = await readTicket(rootDir, missionId, ticketId);
    await (0, promises_1.writeFile)(ticketPath, `${JSON.stringify({ ...ticket, status }, null, 2)}\n`, "utf8");
}
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
(0, node_test_1.default)("mission ticket update puis move recalculent le plan canonique, le board et la reprise", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketA = await createTicket(rootDir, mission.id, {
        goal: "Verifier les prerequis",
        owner: "agent_research",
        successCriteria: ["Les prerequis sont identifies"],
    });
    const ticketB = await createTicket(rootDir, mission.id, {
        goal: "Assembler le plan",
        owner: "agent_plan",
        successCriteria: ["Le plan initial existe"],
        dependsOn: [ticketA],
    });
    const ticketC = await createTicket(rootDir, mission.id, {
        goal: "Documenter la decision",
        owner: "agent_doc",
        successCriteria: ["La decision est tracee"],
    });
    const updateResult = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketB,
        "--goal",
        "Assembler le plan final",
        "--owner",
        "agent_coord",
        "--success-criterion",
        "Le plan final est consolide",
        "--success-criterion",
        " Le plan final est consolide ",
        "--success-criterion",
        "La delegation reste auditable",
        "--allow-capability",
        "fs.read",
        "--allow-capability",
        " fs.read ",
        "--allow-capability",
        "cli.run",
        "--skill-pack",
        "pack.plan",
        "--skill-pack",
        " pack.plan ",
    ]);
    strict_1.default.equal(updateResult.exitCode, 0);
    strict_1.default.equal(updateResult.lines[0], `Ticket mis a jour: ${ticketB}`);
    const moveResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketB,
        "--to-front",
    ]);
    strict_1.default.equal(moveResult.exitCode, 0);
    strict_1.default.equal(moveResult.lines[0], `Ticket deplace: ${ticketB}`);
    const updatedMission = await readMission(rootDir, mission.id);
    const updatedTicketB = await readTicket(rootDir, mission.id, ticketB);
    const updatedTicketA = await readTicket(rootDir, mission.id, ticketA);
    const updatedTicketC = await readTicket(rootDir, mission.id, ticketC);
    const journal = await readJournal(rootDir);
    const updatedEvent = journal.at(-2);
    const movedEvent = journal.at(-1);
    const ticketBoardProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    const resumeViewProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.ok(updatedEvent);
    strict_1.default.ok(movedEvent);
    strict_1.default.equal(updatedTicketB.goal, "Assembler le plan final");
    strict_1.default.equal(updatedTicketB.owner, "agent_coord");
    strict_1.default.deepEqual(updatedTicketB.successCriteria, [
        "Le plan final est consolide",
        "La delegation reste auditable",
    ]);
    strict_1.default.deepEqual(updatedTicketB.dependsOn, [ticketA]);
    strict_1.default.deepEqual(updatedTicketB.allowedCapabilities, ["fs.read", "cli.run"]);
    strict_1.default.deepEqual(updatedTicketB.skillPackRefs, ["pack.plan"]);
    strict_1.default.equal(updatedTicketB.executionHandle.adapter, "codex_responses");
    strict_1.default.deepEqual(updatedTicketB.artifactIds, []);
    strict_1.default.equal(updatedTicketB.createdAt < updatedTicketB.updatedAt, true);
    strict_1.default.equal(updatedTicketB.eventIds.length, 3);
    strict_1.default.deepEqual(updatedMission.ticketIds, [ticketB, ticketA, ticketC]);
    strict_1.default.equal(updatedMission.status, "ready");
    strict_1.default.equal(updatedMission.resumeCursor, movedEvent.eventId);
    strict_1.default.equal(updatedMission.updatedAt, movedEvent.occurredAt);
    strict_1.default.equal(updatedEvent.type, "ticket.updated");
    strict_1.default.equal(updatedEvent.ticketId, ticketB);
    strict_1.default.deepEqual(updatedEvent.payload.changedFields, [
        "goal",
        "owner",
        "successCriteria",
        "allowedCapabilities",
        "skillPackRefs",
    ]);
    strict_1.default.equal(updatedEvent.payload.trigger, "operator");
    strict_1.default.equal(movedEvent.type, "ticket.reprioritized");
    strict_1.default.equal(movedEvent.ticketId, ticketB);
    strict_1.default.equal(movedEvent.payload.previousOrder, 1);
    strict_1.default.equal(movedEvent.payload.nextOrder, 0);
    strict_1.default.deepEqual(movedEvent.payload.orderedTicketIds, [ticketB, ticketA, ticketC]);
    strict_1.default.equal(movedEvent.payload.trigger, "operator");
    strict_1.default.deepEqual(ticketBoardProjection, {
        schemaVersion: 1,
        tickets: [
            {
                ticketId: ticketB,
                missionId: mission.id,
                title: "Assembler le plan final",
                status: "todo",
                owner: "agent_coord",
                kind: "implement",
                dependsOn: [ticketA],
                allowedCapabilities: ["fs.read", "cli.run"],
                skillPackRefs: ["pack.plan"],
                usedCapabilities: [],
                usedSkillPacks: [],
                planOrder: 0,
                runnable: false,
                blockedByTicketIds: [ticketA],
                planningState: "waiting_on_dependencies",
                dependencyStatuses: [
                    {
                        ticketId: ticketA,
                        status: "todo",
                        blocksRunnable: true,
                    },
                ],
                trackingState: "blocked",
                statusReasonCode: "dependency_pending",
                blockingReasonCode: "dependency_pending",
                activeAttemptId: null,
                activeAttemptStatus: null,
                lastAttemptId: null,
                lastAttemptStatus: null,
                lastAttemptStartedAt: null,
                lastAttemptEndedAt: null,
                lastAttemptBackgroundRequested: null,
                lastAttemptWorkspaceIsolationId: null,
                updatedAt: updatedTicketB.updatedAt,
            },
            {
                ticketId: ticketA,
                missionId: mission.id,
                title: "Verifier les prerequis",
                status: "todo",
                owner: "agent_research",
                kind: "implement",
                dependsOn: [],
                allowedCapabilities: [],
                skillPackRefs: [],
                usedCapabilities: [],
                usedSkillPacks: [],
                planOrder: 1,
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
                updatedAt: updatedTicketA.updatedAt,
            },
            {
                ticketId: ticketC,
                missionId: mission.id,
                title: "Documenter la decision",
                status: "todo",
                owner: "agent_doc",
                kind: "implement",
                dependsOn: [],
                allowedCapabilities: [],
                skillPackRefs: [],
                usedCapabilities: [],
                usedSkillPacks: [],
                planOrder: 2,
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
                updatedAt: updatedTicketC.updatedAt,
            },
        ],
    });
    strict_1.default.deepEqual(resumeViewProjection.resume?.openTickets, ticketBoardProjection.tickets);
    strict_1.default.equal(resumeViewProjection.resume?.nextOperatorAction, "Traitez le prochain ticket runnable: Verifier les prerequis.");
    const output = statusResult.lines.join("\n");
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.match(output, new RegExp(`Tickets ouverts: ${ticketB}, ${ticketA}, ${ticketC}`));
    strict_1.default.match(output, /Prochain arbitrage utile: Traitez le prochain ticket runnable: Verifier les prerequis\./);
});
(0, node_test_1.default)("mission ticket update rejette une mutation sans effet sans changer les snapshots ni les projections", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-noop-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Livrer la delegation ticket",
        owner: "agent_dev",
        successCriteria: ["Le ticket reste stable"],
    });
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
    const beforeTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
    const beforeMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
    const beforeTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
    const beforeResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
    const beforeJournal = await readJournal(rootDir);
    const result = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
        "--goal",
        "Livrer la delegation ticket",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Aucune mutation effective detectee pour le ticket \`${ticketId}\`.`);
    const afterMission = await (0, promises_1.readFile)(missionPath, "utf8");
    const afterTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
    const afterMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
    const afterTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
    const afterResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
    const afterJournal = await readJournal(rootDir);
    strict_1.default.equal(afterMission, beforeMission);
    strict_1.default.equal(afterTicket, beforeTicket);
    strict_1.default.equal(afterMissionStatus, beforeMissionStatus);
    strict_1.default.equal(afterTicketBoard, beforeTicketBoard);
    strict_1.default.equal(afterResumeView, beforeResumeView);
    strict_1.default.deepEqual(afterJournal, beforeJournal);
});
(0, node_test_1.default)("mission ticket update traite des dependances identiques comme un no-op", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-reordered-dependencies-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketA = await createTicket(rootDir, mission.id, {
        goal: "Prerequis A",
        owner: "agent_a",
        successCriteria: ["A existe"],
    });
    const ticketB = await createTicket(rootDir, mission.id, {
        goal: "Prerequis B",
        owner: "agent_b",
        successCriteria: ["B existe"],
    });
    const targetTicketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket cible",
        owner: "agent_target",
        successCriteria: ["Le ticket reste stable"],
        dependsOn: [ticketA, ticketB],
    });
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", targetTicketId, "ticket.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
    const beforeTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
    const beforeMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
    const beforeTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
    const beforeResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
    const beforeJournal = await readJournal(rootDir);
    const result = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        targetTicketId,
        "--depends-on",
        ticketA,
        "--depends-on",
        ticketB,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Aucune mutation effective detectee pour le ticket \`${targetTicketId}\`.`);
    strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketPath, "utf8"), beforeTicket);
    strict_1.default.equal(await (0, promises_1.readFile)(missionStatusPath, "utf8"), beforeMissionStatus);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath, "utf8"), beforeTicketBoard);
    strict_1.default.equal(await (0, promises_1.readFile)(resumeViewPath, "utf8"), beforeResumeView);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
});
(0, node_test_1.default)("mission ticket update traite le reordonnancement de allowedCapabilities et skillPackRefs comme un no-op", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-reordered-opaque-refs-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket avec references opaques",
        owner: "agent_refs",
        successCriteria: ["Les references restent stables"],
        allowedCapabilities: ["fs.read", "cli.run"],
        skillPackRefs: ["pack.plan", "pack.audit"],
    });
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
    const beforeTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
    const beforeMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
    const beforeTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
    const beforeResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
    const beforeJournal = await readJournal(rootDir);
    const result = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketId,
        "--allow-capability",
        "cli.run",
        "--allow-capability",
        "fs.read",
        "--skill-pack",
        "pack.audit",
        "--skill-pack",
        "pack.plan",
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `Aucune mutation effective detectee pour le ticket \`${ticketId}\`.`);
    strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketPath, "utf8"), beforeTicket);
    strict_1.default.equal(await (0, promises_1.readFile)(missionStatusPath, "utf8"), beforeMissionStatus);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath, "utf8"), beforeTicketBoard);
    strict_1.default.equal(await (0, promises_1.readFile)(resumeViewPath, "utf8"), beforeResumeView);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
});
(0, node_test_1.default)("mission ticket update rejette les statuts non modifiables sans toucher aux snapshots ni aux projections", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-status-guards-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket non modifiable",
        owner: "agent_guard",
        successCriteria: ["Le ticket existe"],
    });
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const cases = [
        {
            status: "claimed",
            expectedMessage: `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: claimed). `
                + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
        },
        {
            status: "in_progress",
            expectedMessage: `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: in_progress). `
                + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
        },
        {
            status: "blocked",
            expectedMessage: `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: blocked). `
                + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
        },
        {
            status: "failed",
            expectedMessage: `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: failed). `
                + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
        },
    ];
    for (const testCase of cases) {
        await writeTicketStatus(rootDir, mission.id, ticketId, testCase.status);
        const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
        const beforeTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
        const beforeMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
        const beforeTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
        const beforeResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
        const beforeJournal = await readJournal(rootDir);
        const result = await runCommand([
            "mission",
            "ticket",
            "update",
            "--root",
            rootDir,
            "--mission-id",
            mission.id,
            "--ticket-id",
            ticketId,
            "--goal",
            "Nouveau goal non autorise",
        ]);
        strict_1.default.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.status}`);
        strict_1.default.equal(result.lines.at(-1), testCase.expectedMessage, `message inattendu pour ${testCase.status}`);
        strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
        strict_1.default.equal(await (0, promises_1.readFile)(ticketPath, "utf8"), beforeTicket);
        strict_1.default.equal(await (0, promises_1.readFile)(missionStatusPath, "utf8"), beforeMissionStatus);
        strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath, "utf8"), beforeTicketBoard);
        strict_1.default.equal(await (0, promises_1.readFile)(resumeViewPath, "utf8"), beforeResumeView);
        strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
    }
});
(0, node_test_1.default)("updateTicket rejette une mutation directe du champ status", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-direct-status-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, {
        goal: "Ticket a proteger",
        owner: "agent_status",
        successCriteria: ["Le ticket existe"],
    });
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "tickets", ticketId, "ticket.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
    const beforeTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
    const beforeMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
    const beforeTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
    const beforeResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
    const beforeJournal = await readJournal(rootDir);
    const directStatusMutationOptions = {
        rootDir,
        missionId: mission.id,
        ticketId,
        goal: "Goal ignore",
        owner: undefined,
        successCriteria: [],
        dependsOn: [],
        clearDependsOn: false,
        allowedCapabilities: [],
        clearAllowedCapabilities: false,
        skillPackRefs: [],
        clearSkillPackRefs: false,
        status: "done",
    };
    await strict_1.default.rejects(() => (0, update_ticket_1.updateTicket)(directStatusMutationOptions), new Error(`Le statut du ticket ${ticketId} ne peut pas etre modifie via \`corp mission ticket update\`. `
        + "Utilisez les commandes de transition dediees."));
    strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketPath, "utf8"), beforeTicket);
    strict_1.default.equal(await (0, promises_1.readFile)(missionStatusPath, "utf8"), beforeMissionStatus);
    strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath, "utf8"), beforeTicketBoard);
    strict_1.default.equal(await (0, promises_1.readFile)(resumeViewPath, "utf8"), beforeResumeView);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
});
(0, node_test_1.default)("mission ticket update protege le graphe contre l'auto-reference, les cycles et les dependances annulees", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-graph-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketA = await createTicket(rootDir, mission.id, {
        goal: "Ticket A",
        owner: "agent_a",
        successCriteria: ["A existe"],
    });
    const ticketB = await createTicket(rootDir, mission.id, {
        goal: "Ticket B",
        owner: "agent_b",
        successCriteria: ["B existe"],
        dependsOn: [ticketA],
    });
    const ticketC = await createTicket(rootDir, mission.id, {
        goal: "Ticket C",
        owner: "agent_c",
        successCriteria: ["C existe"],
    });
    const beforeAutoJournal = await readJournal(rootDir);
    const autoReferenceResult = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketA,
        "--depends-on",
        ticketA,
    ]);
    strict_1.default.equal(autoReferenceResult.exitCode, 1);
    strict_1.default.equal(autoReferenceResult.lines.at(-1), `Le ticket \`${ticketA}\` ne peut pas dependre de lui-meme.`);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeAutoJournal);
    const beforeCycleJournal = await readJournal(rootDir);
    const cycleResult = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketA,
        "--depends-on",
        ticketB,
    ]);
    strict_1.default.equal(cycleResult.exitCode, 1);
    strict_1.default.equal(cycleResult.lines.at(-1), `La mise a jour du ticket \`${ticketA}\` introduit un cycle de dependances.`);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeCycleJournal);
    const cancelResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketC,
    ]);
    strict_1.default.equal(cancelResult.exitCode, 0);
    const beforeCancelledDependencyJournal = await readJournal(rootDir);
    const cancelledDependencyResult = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketA,
        "--depends-on",
        ticketC,
    ]);
    strict_1.default.equal(cancelledDependencyResult.exitCode, 1);
    strict_1.default.equal(cancelledDependencyResult.lines.at(-1), `La dependance \`${ticketC}\` est deja \`cancelled\` dans la mission \`${mission.id}\`.`);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeCancelledDependencyJournal);
});
(0, node_test_1.default)("mission ticket update detecte aussi un cycle de dependances a trois noeuds", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-update-ticket-cycle-three-nodes-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketA = await createTicket(rootDir, mission.id, {
        goal: "Ticket A",
        owner: "agent_a",
        successCriteria: ["A existe"],
    });
    const ticketB = await createTicket(rootDir, mission.id, {
        goal: "Ticket B",
        owner: "agent_b",
        successCriteria: ["B existe"],
        dependsOn: [ticketA],
    });
    const ticketC = await createTicket(rootDir, mission.id, {
        goal: "Ticket C",
        owner: "agent_c",
        successCriteria: ["C existe"],
        dependsOn: [ticketB],
    });
    const beforeJournal = await readJournal(rootDir);
    const result = await runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        ticketA,
        "--depends-on",
        ticketC,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.equal(result.lines.at(-1), `La mise a jour du ticket \`${ticketA}\` introduit un cycle de dependances.`);
    strict_1.default.deepEqual(await readJournal(rootDir), beforeJournal);
});
