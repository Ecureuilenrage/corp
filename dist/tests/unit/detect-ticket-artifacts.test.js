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
const detect_ticket_artifacts_1 = require("../../packages/ticket-runtime/src/artifact-service/detect-ticket-artifacts");
function createIsolation(sourceRoot, workspacePath) {
    return {
        workspaceIsolationId: "iso_detect",
        kind: "workspace_copy",
        sourceRoot,
        workspacePath,
        createdAt: "2026-04-10T00:00:00.000Z",
        retained: true,
    };
}
function createProducingEvent() {
    return {
        eventId: "event_terminal",
        type: "execution.completed",
        missionId: "mission_detect",
        ticketId: "ticket_detect",
        attemptId: "attempt_detect",
        occurredAt: "2026-04-10T00:00:00.000Z",
        actor: "adapter",
        source: "codex_responses",
        payload: {},
    };
}
(0, node_test_1.default)("detectTicketArtifacts echoue explicitement sur un kind d'output inconnu", async (t) => {
    const sourceRoot = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-detect-source-"));
    const workspacePath = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-detect-workspace-"));
    t.after(async () => {
        await (0, promises_1.rm)(sourceRoot, { recursive: true, force: true });
        await (0, promises_1.rm)(workspacePath, { recursive: true, force: true });
    });
    await strict_1.default.rejects((0, detect_ticket_artifacts_1.detectTicketArtifacts)({
        adapterOutputs: [
            {
                kind: "video",
                title: "Sortie video",
            },
        ],
        isolation: createIsolation(sourceRoot, workspacePath),
        producingEvent: createProducingEvent(),
    }), /Kind d'output adaptateur non reconnu: video/);
});
(0, node_test_1.default)("detectTicketArtifacts renseigne sizeBytes meme quand un structured_output volumineux n'a pas de payload inline", async (t) => {
    const sourceRoot = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-detect-large-source-"));
    const workspacePath = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-detect-large-workspace-"));
    t.after(async () => {
        await (0, promises_1.rm)(sourceRoot, { recursive: true, force: true });
        await (0, promises_1.rm)(workspacePath, { recursive: true, force: true });
    });
    const artifacts = await (0, detect_ticket_artifacts_1.detectTicketArtifacts)({
        adapterOutputs: [
            {
                kind: "structured",
                title: "Rapport massif",
                data: {
                    text: "€".repeat(7000),
                },
            },
        ],
        isolation: createIsolation(sourceRoot, workspacePath),
        producingEvent: createProducingEvent(),
    });
    strict_1.default.equal(artifacts.length, 1);
    strict_1.default.equal(artifacts[0]?.kind, "structured_output");
    strict_1.default.equal(artifacts[0]?.payload, undefined);
    strict_1.default.ok((artifacts[0]?.sizeBytes ?? 0) > 16000);
    strict_1.default.match(artifacts[0]?.summary ?? "", /payload tronque/i);
});
