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
const file_event_log_1 = require("../../packages/journal/src/event-log/file-event-log");
const read_approval_queue_1 = require("../../packages/mission-kernel/src/resume-service/read-approval-queue");
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
async function bootstrapAndCreateMission(rootDir) {
    const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(bootstrapResult.exitCode, 0);
    const createResult = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission approval queue",
        "--objective",
        "Verifier la lecture defensive de la queue",
        "--success-criterion",
        "La queue reste lisible",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const missionLine = createResult.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionLine);
    return missionLine.slice("Mission creee: ".length);
}
(0, node_test_1.default)("readApprovalQueue lit le journal une seule fois quand il doit reconstruire la mission depuis le journal", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-read-approval-queue-single-read-"));
    t.after(async () => {
        (0, read_approval_queue_1.setReadApprovalQueueDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const missionId = await bootstrapAndCreateMission(rootDir);
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json");
    let readCount = 0;
    await (0, promises_1.rm)(missionPath, { force: true });
    (0, read_approval_queue_1.setReadApprovalQueueDependenciesForTesting)({
        readEventLog: async (...args) => {
            readCount += 1;
            return (0, file_event_log_1.readEventLog)(...args);
        },
    });
    const result = await (0, read_approval_queue_1.readApprovalQueue)({
        rootDir,
        missionId,
        commandName: "approval queue",
    });
    strict_1.default.equal(result.mission.id, missionId);
    strict_1.default.equal(readCount, 1);
});
(0, node_test_1.default)("readApprovalQueue recree le dossier projections manquant quand le journal existe", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-read-approval-queue-projections-"));
    t.after(async () => {
        (0, read_approval_queue_1.setReadApprovalQueueDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const missionId = await bootstrapAndCreateMission(rootDir);
    const projectionsDir = node_path_1.default.join(rootDir, ".corp", "projections");
    const projectionPath = node_path_1.default.join(projectionsDir, "approval-queue.json");
    await (0, promises_1.rm)(projectionsDir, { recursive: true, force: true });
    const result = await (0, read_approval_queue_1.readApprovalQueue)({
        rootDir,
        missionId,
        commandName: "approval queue",
    });
    strict_1.default.equal(result.mission.id, missionId);
    await (0, promises_1.access)(projectionPath);
});
