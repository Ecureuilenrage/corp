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
const file_ticket_repository_1 = require("../../packages/storage/src/repositories/file-ticket-repository");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
function createTicketSnapshot(missionId, ticketId) {
    return {
        id: ticketId,
        missionId,
        kind: "implement",
        goal: "Ticket de test",
        status: "todo",
        owner: "agent_repo",
        dependsOn: [],
        successCriteria: ["Le ticket existe"],
        allowedCapabilities: [],
        skillPackRefs: [],
        workspaceIsolationId: null,
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [],
        eventIds: ["event_repo"],
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
    };
}
(0, node_test_1.default)("findOwningMissionId ignore les repertoires mission invalides avant de resoudre un ticket", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-file-ticket-repository-invalid-dir-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    const missionId = "mission_valid_owner";
    const ticketId = "ticket_owned";
    await (0, promises_1.mkdir)(node_path_1.default.join(layout.missionsDir, missionId), { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(layout.missionsDir, missionId, "mission.json"), `${JSON.stringify({
        id: missionId,
        title: "Mission demo",
        objective: "Retrouver le ticket",
        status: "ready",
        successCriteria: ["Le ticket est reference"],
        policyProfileId: "policy_profile_local",
        ticketIds: [ticketId],
        artifactIds: [],
        eventIds: ["event_repo"],
        resumeCursor: "event_repo",
        createdAt: "2026-04-10T00:00:00.000Z",
        updatedAt: "2026-04-10T00:00:00.000Z",
    }, null, 2)}\n`, "utf8");
    await repository.save(createTicketSnapshot(missionId, ticketId));
    await (0, promises_1.mkdir)(node_path_1.default.join(layout.missionsDir, "mission_..poison"), { recursive: true });
    const owningMissionId = await repository.findOwningMissionId(ticketId);
    strict_1.default.equal(owningMissionId, missionId);
});
(0, node_test_1.default)("findOwningMissionId rejette une recherche exhaustive quand trop de missions valides existent", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-file-ticket-repository-threshold-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_ticket_repository_1.createFileTicketRepository)(layout);
    for (let index = 0; index <= file_ticket_repository_1.MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP; index += 1) {
        await (0, promises_1.mkdir)(node_path_1.default.join(layout.missionsDir, `mission_load_${String(index).padStart(2, "0")}`), { recursive: true });
    }
    await strict_1.default.rejects(() => repository.findOwningMissionId("ticket_inconnu"), new Error("Trop de missions pour une recherche exhaustive."));
});
