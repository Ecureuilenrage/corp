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
(0, node_test_1.default)("mission create persiste la mission, le journal initial et les projections minimales", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-create-mission-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(bootstrapResult.exitCode, 0);
    const createResult = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission V1",
        "--objective",
        "Poser une mission persistante et local-first",
        "--success-criterion",
        "Un journal initial existe",
        "--success-criterion",
        "Les projections restent coherentes",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const missionCreatedLine = createResult.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionCreatedLine, "la sortie doit inclure l'identifiant de mission");
    const missionId = missionCreatedLine.slice("Mission creee: ".length);
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json");
    const mission = await readJson(missionPath);
    strict_1.default.match(missionId, /^mission_/);
    strict_1.default.equal(mission.id, missionId);
    strict_1.default.equal(mission.title, "Mission V1");
    strict_1.default.equal(mission.objective, "Poser une mission persistante et local-first");
    strict_1.default.equal(mission.status, "ready");
    strict_1.default.deepEqual(mission.successCriteria, [
        "Un journal initial existe",
        "Les projections restent coherentes",
    ]);
    strict_1.default.equal(mission.policyProfileId, "policy_profile_local");
    strict_1.default.deepEqual(mission.ticketIds, []);
    strict_1.default.deepEqual(mission.artifactIds, []);
    strict_1.default.equal(mission.createdAt, mission.updatedAt);
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const journalEntries = (await (0, promises_1.readFile)(journalPath, "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
    strict_1.default.equal(journalEntries.length, 1);
    const [missionCreatedEvent] = journalEntries;
    const firstEventId = missionCreatedEvent.eventId;
    strict_1.default.match(String(firstEventId), /^event_/);
    strict_1.default.equal(missionCreatedEvent.type, "mission.created");
    strict_1.default.equal(missionCreatedEvent.missionId, missionId);
    strict_1.default.equal(mission.resumeCursor, firstEventId);
    strict_1.default.deepEqual(mission.eventIds, [firstEventId]);
    strict_1.default.deepEqual(missionCreatedEvent.payload, { mission });
    const missionStatusProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json"));
    const resumeViewProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    const ticketBoardProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json"));
    const approvalQueueProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
    const artifactIndexProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "artifact-index.json"));
    strict_1.default.deepEqual(missionStatusProjection, {
        schemaVersion: 1,
        mission,
    });
    strict_1.default.deepEqual(resumeViewProjection, {
        schemaVersion: 1,
        resume: {
            missionId,
            title: "Mission V1",
            objective: "Poser une mission persistante et local-first",
            status: "ready",
            successCriteria: [
                "Un journal initial existe",
                "Les projections restent coherentes",
            ],
            authorizedExtensions: {
                allowedCapabilities: [],
                skillPackRefs: [],
            },
            openTickets: [],
            pendingApprovals: [],
            lastRelevantArtifact: null,
            lastKnownBlockage: null,
            lastEventId: firstEventId,
            updatedAt: mission.updatedAt,
            nextOperatorAction: "Aucun ticket n'existe encore. La prochaine etape probable releve de la suite Epic 1 / Epic 2.",
        },
    });
    strict_1.default.deepEqual(ticketBoardProjection, {
        schemaVersion: 1,
        tickets: [],
    });
    strict_1.default.deepEqual(approvalQueueProjection, {
        schemaVersion: 1,
        approvals: [],
    });
    strict_1.default.deepEqual(artifactIndexProjection, {
        schemaVersion: 1,
        artifacts: [],
    });
    strict_1.default.match(createResult.lines.join("\n"), /Prochaine action suggeree:/i);
});
