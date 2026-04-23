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
const default_projections_1 = require("../../packages/journal/src/projections/default-projections");
const persisted_document_errors_1 = require("../../packages/storage/src/repositories/persisted-document-errors");
const file_projection_store_1 = require("../../packages/storage/src/projection-store/file-projection-store");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const read_mission_resume_1 = require("../../packages/mission-kernel/src/resume-service/read-mission-resume");
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
        "Mission read resume",
        "--objective",
        "Verifier la lecture defensive du resume",
        "--success-criterion",
        "Le resume reste lisible",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const missionLine = createResult.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionLine);
    return missionLine.slice("Mission creee: ".length);
}
(0, node_test_1.default)("readStoredResumeView classe explicitement une projection resume-view corrompue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-read-stored-resume-view-"));
    const projectionsDir = node_path_1.default.join(rootDir, "projections");
    const projectionPath = node_path_1.default.join(projectionsDir, "resume-view.json");
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await (0, promises_1.mkdir)(projectionsDir, { recursive: true });
    await (0, promises_1.writeFile)(projectionPath, "{corrupted", "utf8");
    const result = await (0, read_mission_resume_1.readStoredResumeView)(projectionsDir);
    strict_1.default.equal(result.projection, null);
    strict_1.default.ok(result.readError instanceof persisted_document_errors_1.CorruptedPersistedDocumentError);
    strict_1.default.equal(result.readError.filePath, projectionPath);
});
(0, node_test_1.default)("readMissionResume preserve la cause d'une erreur inattendue issue de readMissionEvents", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-read-mission-resume-cause-"));
    const missionId = await bootstrapAndCreateMission(rootDir);
    const missionReconstructionModule = require("../../packages/journal/src/reconstruction/mission-reconstruction");
    const originalReadMissionEvents = missionReconstructionModule.readMissionEvents;
    const rootCause = new TypeError("synthetic mission resume failure");
    let mockInvocationCount = 0;
    t.after(async () => {
        missionReconstructionModule.readMissionEvents = originalReadMissionEvents;
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    missionReconstructionModule.readMissionEvents = async () => {
        mockInvocationCount += 1;
        throw rootCause;
    };
    await strict_1.default.rejects(() => (0, read_mission_resume_1.readMissionResume)({
        rootDir,
        missionId,
        commandName: "resume",
    }), (error) => {
        strict_1.default.ok(error instanceof Error);
        strict_1.default.match(error.message, /Journal mission irreconciliable/);
        strict_1.default.equal(error.cause, rootCause);
        return true;
    });
    // Le monkey-patch doit avoir ete appele : sans cette assertion, une migration
    // future vers ESM figerait l'export et ferait passer le test en silence.
    strict_1.default.equal(mockInvocationCount, 1);
});
(0, node_test_1.default)("readMissionResume signale explicitement un workspace legacy sans registres d'extensions", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-read-mission-resume-legacy-layout-"));
    const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(rootDir);
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await (0, promises_1.mkdir)(layout.journalDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.projectionsDir, { recursive: true });
    await (0, promises_1.mkdir)(layout.missionsDir, { recursive: true });
    await (0, promises_1.writeFile)(layout.journalPath, "", "utf8");
    await (0, promises_1.writeFile)((0, file_projection_store_1.resolveProjectionPath)(layout.projectionsDir, "resume-view"), `${JSON.stringify(default_projections_1.DEFAULT_PROJECTIONS["resume-view"], null, 2)}\n`, "utf8");
    await strict_1.default.rejects(() => (0, read_mission_resume_1.readMissionResume)({
        rootDir,
        missionId: "mission_legacy",
        commandName: "resume",
    }), /Workspace mission non initialise\. Lancez `corp mission bootstrap --root .*` avant `corp mission resume`\./);
});
