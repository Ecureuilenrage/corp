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
async function readJournal(rootDir) {
    return (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
}
function getFixturePath(fileName) {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", fileName);
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
        "Mission capability audit",
        "--objective",
        "Tracer l'usage d'une capability en runtime",
        "--success-criterion",
        "Le ticket est runnable",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const missionId = String(result.lines.find((line) => line.startsWith("Mission creee: "))?.slice("Mission creee: ".length));
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json");
    const mission = await readJson(missionPath);
    await (0, promises_1.writeFile)(missionPath, `${JSON.stringify({
        ...mission,
        authorizedExtensions: {
            allowedCapabilities: ["shell.exec"],
            skillPackRefs: [],
        },
    }, null, 2)}\n`, "utf8");
    return readJson(missionPath);
}
async function createTicket(rootDir, missionId, extraArgs = []) {
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
        "Utiliser une capability enregistr ee",
        "--owner",
        "agent_capability",
        "--success-criterion",
        "La capability est resolue",
        ...extraArgs,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    return String(result.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
}
(0, node_test_1.default)("mission ticket run emet capability.invoked et rend l'audit lisible pour une capability enregistree", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-audit-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const registerResult = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        getFixturePath("valid-capability-local.json"),
    ]);
    strict_1.default.equal(registerResult.exitCode, 0);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "shell.exec",
    ]);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async () => ({
                status: "completed",
                adapterState: {
                    responseId: "resp_capability_audit",
                    pollCursor: "cursor_capability_audit",
                    vendorStatus: "completed",
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
        ticketId,
    ]);
    const journal = await readJournal(rootDir);
    const capabilityEvent = journal.find((event) => event.type === "capability.invoked");
    const auditProjection = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "audit-log.json"));
    const auditResult = await runCommand([
        "mission",
        "audit",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    strict_1.default.ok(capabilityEvent, "capability.invoked doit etre journalise");
    strict_1.default.equal(capabilityEvent.missionId, mission.id);
    strict_1.default.equal(capabilityEvent.ticketId, ticketId);
    strict_1.default.equal(capabilityEvent.actor, "system");
    strict_1.default.equal(capabilityEvent.source, "ticket-runtime");
    strict_1.default.deepEqual(capabilityEvent.payload.capability, {
        capabilityId: "shell.exec",
        registrationId: "ext.capability.shell.exec.local",
        provider: "local",
        approvalSensitive: true,
        permissions: ["shell.exec", "fs.read"],
        constraints: ["local_only", "approval_sensitive", "workspace_scoped"],
        requiredEnvNames: [],
    });
    strict_1.default.deepEqual(capabilityEvent.payload.guardrails, [
        "approval_sensitive: shell.exec",
        "policy_profile: policy_profile_local",
        "allowed_capabilities: shell.exec",
    ]);
    const auditEntry = auditProjection.entries.find((entry) => entry.eventType === "capability.invoked");
    strict_1.default.ok(auditEntry);
    strict_1.default.equal(auditEntry.ticketId, ticketId);
    strict_1.default.equal(auditEntry.attemptId, capabilityEvent.attemptId);
    strict_1.default.equal(auditEntry.source, "ticket-runtime");
    strict_1.default.equal(auditEntry.title, "Capability invoquee");
    strict_1.default.match(auditEntry.summary, /shell\.exec/);
    const auditOutput = auditResult.lines.join("\n");
    strict_1.default.equal(auditResult.exitCode, 0);
    strict_1.default.match(auditOutput, /Capability invoquee/);
    strict_1.default.match(auditOutput, /shell\.exec/);
    strict_1.default.doesNotMatch(JSON.stringify(journal), /resp_capability_audit|cursor_capability_audit|vendorStatus|pollCursor|responseId/i);
    strict_1.default.doesNotMatch(`${JSON.stringify(auditProjection)}\n${auditOutput}`, /resp_capability_audit|cursor_capability_audit|vendorStatus|pollCursor|responseId/i);
});
(0, node_test_1.default)("mission ticket run ignore fs.read et cli.run comme built-ins sans emettre capability.invoked", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-builtins-"));
    let launchCount = 0;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "fs.read",
        "--allow-capability",
        "cli.run",
    ]);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async () => {
                launchCount += 1;
                return {
                    status: "completed",
                    adapterState: {
                        responseId: "resp_builtin_capability",
                        pollCursor: "cursor_builtin_capability",
                        vendorStatus: "completed",
                    },
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
        ticketId,
    ]);
    const journal = await readJournal(rootDir);
    strict_1.default.equal(runResult.exitCode, 0);
    strict_1.default.equal(launchCount, 1);
    strict_1.default.equal(journal.some((event) => event.type === "capability.invoked"), false);
    strict_1.default.equal(journal.at(-1)?.type, "execution.completed");
});
(0, node_test_1.default)("mission ticket run echoue avant execution externe quand la capability referencee est absente du registre", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-capability-missing-"));
    let launchCount = 0;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "shell.exec",
    ]);
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async () => {
                launchCount += 1;
                return {
                    status: "completed",
                    adapterState: {
                        responseId: "resp_should_not_run",
                    },
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
        ticketId,
    ]);
    const journal = await readJournal(rootDir);
    strict_1.default.equal(runResult.exitCode, 1);
    strict_1.default.equal(launchCount, 0);
    strict_1.default.match(runResult.lines.join("\n"), /Capability introuvable.*shell\.exec/i);
    strict_1.default.deepEqual(journal.map((event) => event.type), ["mission.created", "ticket.created"]);
});
