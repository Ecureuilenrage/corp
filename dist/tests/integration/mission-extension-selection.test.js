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
const file_mission_repository_1 = require("../../packages/storage/src/repositories/file-mission-repository");
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
        "Mission extensions",
        "--objective",
        "Gouverner les extensions autorisees par mission",
        "--success-criterion",
        "Les extensions sont bornees par mission",
        "--success-criterion",
        "Leur usage est lisible en CLI",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const missionId = String(result.lines.find((line) => line.startsWith("Mission creee: "))?.slice("Mission creee: ".length));
    return readMission(rootDir, missionId);
}
async function readMission(rootDir, missionId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json"));
}
async function writeMissionStatus(rootDir, missionId, status) {
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json");
    const mission = await readMission(rootDir, missionId);
    await (0, promises_1.writeFile)(missionPath, `${JSON.stringify({ ...mission, status }, null, 2)}\n`, "utf8");
}
async function readTicket(rootDir, missionId, ticketId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json"));
}
async function readAttempt(rootDir, missionId, ticketId, attemptId) {
    return readJson(node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "attempts", attemptId, "attempt.json"));
}
async function registerCapability(rootDir) {
    const result = await runCommand([
        "extension",
        "capability",
        "register",
        "--root",
        rootDir,
        "--file",
        node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", "valid-capability-local.json"),
    ]);
    strict_1.default.equal(result.exitCode, 0);
}
async function registerSkillPack(rootDir, packRef = "pack.triage.local") {
    const sourceFixtureRoot = node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions");
    const sourceManifestPath = node_path_1.default.join(sourceFixtureRoot, "valid-skill-pack.json");
    const fixtureRoot = node_path_1.default.join(rootDir, ".skill-pack-fixtures");
    const manifestPath = node_path_1.default.join(fixtureRoot, `${packRef.replace(/\./g, "-")}.skill-pack.json`);
    const manifest = JSON.parse(await (0, promises_1.readFile)(sourceManifestPath, "utf8"));
    const skillPack = manifest.skillPack;
    await (0, promises_1.cp)(node_path_1.default.join(sourceFixtureRoot, "skill-packs"), node_path_1.default.join(fixtureRoot, "skill-packs"), { recursive: true });
    manifest.id = `ext.skill-pack.${packRef}.test`;
    manifest.displayName = `Pack ${packRef}`;
    manifest.skillPack = {
        ...skillPack,
        packRef,
    };
    await (0, promises_1.writeFile)(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const registerResult = await runCommand([
        "extension",
        "skill-pack",
        "register",
        "--root",
        rootDir,
        "--file",
        manifestPath,
    ]);
    strict_1.default.equal(registerResult.exitCode, 0);
}
async function selectMissionExtensions(rootDir, missionId, extraArgs) {
    return runCommand([
        "mission",
        "extension",
        "select",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        ...extraArgs,
    ]);
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
        "Executer une operation gouvernee",
        "--owner",
        "agent_extension",
        "--success-criterion",
        "Le ticket reste gouverne",
        ...extraArgs,
    ]);
}
async function updateTicket(rootDir, missionId, ticketId, extraArgs) {
    return runCommand([
        "mission",
        "ticket",
        "update",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
        ...extraArgs,
    ]);
}
async function openApproval(rootDir, missionId, ticketId) {
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "awaiting_approval",
                adapterState: {
                    responseId: "resp_extensions_approval",
                    pollCursor: "cursor_extensions_approval",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation extension",
                    actionType: "workspace_write",
                    actionSummary: "Confirmer la gouvernance des extensions",
                    guardrails: ["manual_review: workspace_write"],
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
        missionId,
        "--ticket-id",
        ticketId,
        "--background",
    ]);
    strict_1.default.equal(runResult.exitCode, 0);
    const approvalQueue = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json"));
    strict_1.default.equal(approvalQueue.approvals.length, 1);
    return approvalQueue.approvals[0];
}
(0, node_test_1.default)("mission create initialise authorizedExtensions a vide et mission extension select journalise la mutation", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-extension-select-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    await registerCapability(rootDir);
    await registerSkillPack(rootDir);
    const mission = await createMission(rootDir);
    strict_1.default.deepEqual(mission.authorizedExtensions, {
        allowedCapabilities: [],
        skillPackRefs: [],
    });
    const selectResult = await selectMissionExtensions(rootDir, mission.id, [
        "--allow-capability",
        "shell.exec",
        "--skill-pack",
        "pack.triage.local",
    ]);
    const missionAfter = await readMission(rootDir, mission.id);
    const journal = await readJournal(rootDir);
    const selectionEvent = journal.find((event) => event.type === "mission.extensions_selected");
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
    ]);
    strict_1.default.equal(selectResult.exitCode, 0);
    strict_1.default.deepEqual(missionAfter.authorizedExtensions, {
        allowedCapabilities: ["shell.exec"],
        skillPackRefs: ["pack.triage.local"],
    });
    strict_1.default.ok(selectionEvent);
    strict_1.default.deepEqual(selectionEvent.payload.previousAuthorizedExtensions, {
        allowedCapabilities: [],
        skillPackRefs: [],
    });
    strict_1.default.deepEqual(selectionEvent.payload.authorizedExtensions, {
        allowedCapabilities: ["shell.exec"],
        skillPackRefs: ["pack.triage.local"],
    });
    strict_1.default.deepEqual(selectionEvent.payload.changedFields, [
        "allowedCapabilities",
        "skillPackRefs",
    ]);
    strict_1.default.equal(selectionEvent.payload.trigger, "operator");
    strict_1.default.match(selectResult.lines.join("\n"), /Extensions mission mises a jour/i);
    strict_1.default.match(statusResult.lines.join("\n"), /Capabilities mission: shell\.exec/);
    strict_1.default.match(statusResult.lines.join("\n"), /Skill packs mission: pack\.triage\.local/);
});
(0, node_test_1.default)("mission extension select rejette les built-ins et les refs non enregistrees de maniere deterministe", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-extension-errors-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const mission = await createMission(rootDir);
    const builtInResult = await selectMissionExtensions(rootDir, mission.id, [
        "--allow-capability",
        "fs.read",
    ]);
    const unknownCapabilityResult = await selectMissionExtensions(rootDir, mission.id, [
        "--allow-capability",
        "shell.exec",
    ]);
    const unknownPackResult = await selectMissionExtensions(rootDir, mission.id, [
        "--skill-pack",
        "pack.unknown",
    ]);
    const emptyMutationResult = await selectMissionExtensions(rootDir, mission.id, []);
    strict_1.default.equal(builtInResult.exitCode, 1);
    strict_1.default.equal(builtInResult.lines.at(-1), "La capability built-in `fs.read` reste hors selection mission. N'utilisez pas `corp mission extension select` pour les built-ins.");
    strict_1.default.equal(unknownCapabilityResult.exitCode, 1);
    strict_1.default.equal(unknownCapabilityResult.lines.at(-1), "Capability introuvable dans le registre local: shell.exec.");
    strict_1.default.equal(unknownPackResult.exitCode, 1);
    strict_1.default.equal(unknownPackResult.lines.at(-1), "Skill pack introuvable dans le registre local: pack.unknown.");
    strict_1.default.equal(emptyMutationResult.exitCode, 1);
    strict_1.default.equal(emptyMutationResult.lines.at(-1), "Aucune mutation demandee pour `corp mission extension select`.");
});
(0, node_test_1.default)("mission extension select et ticket create restent coherents quand les refs varient seulement par la casse", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-extension-casefold-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    await registerCapability(rootDir);
    await registerSkillPack(rootDir);
    const mission = await createMission(rootDir);
    const selectResult = await selectMissionExtensions(rootDir, mission.id, [
        "--allow-capability",
        "Shell.Exec",
        "--skill-pack",
        "Pack.Triage.Local",
    ]);
    strict_1.default.equal(selectResult.exitCode, 0);
    const missionAfterSelection = await readMission(rootDir, mission.id);
    strict_1.default.deepEqual(missionAfterSelection.authorizedExtensions, {
        allowedCapabilities: ["shell.exec"],
        skillPackRefs: ["pack.triage.local"],
    });
    const createResult = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "FS.READ",
        "--allow-capability",
        "CLI.RUN",
        "--allow-capability",
        "Shell.Exec",
        "--skill-pack",
        "Pack.Triage.Local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const ticketId = String(createResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const ticket = await readTicket(rootDir, mission.id, ticketId);
    strict_1.default.deepEqual(ticket.allowedCapabilities, ["fs.read", "cli.run", "shell.exec"]);
    strict_1.default.deepEqual(ticket.skillPackRefs, ["pack.triage.local"]);
});
(0, node_test_1.default)("mission extension select rejette les missions terminales de maniere deterministe", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-extension-terminal-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    await registerCapability(rootDir);
    const mission = await createMission(rootDir);
    for (const terminalStatus of ["completed", "cancelled", "failed"]) {
        await writeMissionStatus(rootDir, mission.id, terminalStatus);
        const result = await selectMissionExtensions(rootDir, mission.id, [
            "--allow-capability",
            "shell.exec",
        ]);
        strict_1.default.equal(result.exitCode, 1);
        strict_1.default.equal(result.lines.at(-1), `Impossible de modifier la selection d'extensions de la mission \`${mission.id}\` car son statut est terminal (\`${terminalStatus}\`).`);
    }
});
(0, node_test_1.default)("mission extension select detecte un conflit concurrent au lieu d'un dernier-writer-gagne", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-extension-concurrent-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    await registerCapability(rootDir);
    await registerSkillPack(rootDir);
    const mission = await createMission(rootDir);
    const originalFindById = file_mission_repository_1.FileMissionRepository.prototype.findById;
    let synchronizedReads = 0;
    let releaseReads;
    const readBarrier = new Promise((resolve) => {
        releaseReads = resolve;
    });
    file_mission_repository_1.FileMissionRepository.prototype.findById = async function patchedFindById(missionId) {
        const foundMission = await originalFindById.call(this, missionId);
        if (missionId === mission.id && synchronizedReads < 2) {
            synchronizedReads += 1;
            if (synchronizedReads === 2) {
                releaseReads();
            }
            await readBarrier;
        }
        return foundMission;
    };
    t.after(() => {
        file_mission_repository_1.FileMissionRepository.prototype.findById = originalFindById;
    });
    const results = await Promise.all([
        selectMissionExtensions(rootDir, mission.id, ["--allow-capability", "shell.exec"]),
        selectMissionExtensions(rootDir, mission.id, ["--skill-pack", "pack.triage.local"]),
    ]);
    const successes = results.filter((result) => result.exitCode === 0);
    const failures = results.filter((result) => result.exitCode === 1);
    strict_1.default.equal(successes.length, 1);
    strict_1.default.equal(failures.length, 1);
    strict_1.default.match(failures[0].lines.at(-1) ?? "", /conflit d'ecriture concurrente/i);
});
(0, node_test_1.default)("la selection mission borne create update approval et run sans casser les built-ins", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-extension-governance-"));
    let launchCount = 0;
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    await registerCapability(rootDir);
    await registerSkillPack(rootDir);
    const mission = await createMission(rootDir);
    const initialSelectResult = await selectMissionExtensions(rootDir, mission.id, [
        "--allow-capability",
        "shell.exec",
        "--skill-pack",
        "pack.triage.local",
    ]);
    strict_1.default.equal(initialSelectResult.exitCode, 0);
    const unauthorizedCreateResult = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "shell.write",
    ]);
    strict_1.default.equal(unauthorizedCreateResult.exitCode, 1);
    strict_1.default.equal(unauthorizedCreateResult.lines.at(-1), `La capability \`shell.write\` n'est pas autorisee par la mission \`${mission.id}\`.`);
    const createResult = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "fs.read",
        "--allow-capability",
        "cli.run",
        "--allow-capability",
        "shell.exec",
        "--skill-pack",
        "pack.triage.local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const ticketId = String(createResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const restrictedRunTicketResult = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "shell.exec",
        "--skill-pack",
        "pack.triage.local",
    ]);
    strict_1.default.equal(restrictedRunTicketResult.exitCode, 0);
    const restrictedRunTicketId = String(restrictedRunTicketResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const unauthorizedUpdateResult = await updateTicket(rootDir, mission.id, ticketId, [
        "--skill-pack",
        "pack.review",
    ]);
    strict_1.default.equal(unauthorizedUpdateResult.exitCode, 1);
    strict_1.default.equal(unauthorizedUpdateResult.lines.at(-1), `Le skill pack \`pack.review\` n'est pas autorise par la mission \`${mission.id}\`.`);
    const approval = await openApproval(rootDir, mission.id, ticketId);
    const unauthorizedApprovalResult = await runCommand([
        "mission",
        "approval",
        "approve",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--approval-id",
        approval.approvalId,
        "--skill-pack",
        "pack.review",
    ]);
    strict_1.default.equal(unauthorizedApprovalResult.exitCode, 1);
    strict_1.default.equal(unauthorizedApprovalResult.lines.at(-1), `Le skill pack \`pack.review\` n'est pas autorise par la mission \`${mission.id}\`.`);
    await writeMissionStatus(rootDir, mission.id, "ready");
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_exec",
            launch: async () => {
                launchCount += 1;
                return {
                    status: "completed",
                    adapterState: {},
                };
            },
        }),
    });
    const narrowedSelectionResult = await selectMissionExtensions(rootDir, mission.id, [
        "--clear-allow-capability",
        "--clear-skill-pack",
    ]);
    strict_1.default.equal(narrowedSelectionResult.exitCode, 0);
    const runAfterRestrictionResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        restrictedRunTicketId,
    ]);
    strict_1.default.equal(runAfterRestrictionResult.exitCode, 1);
    strict_1.default.equal(launchCount, 0);
    strict_1.default.equal(runAfterRestrictionResult.lines.at(-1), `La capability \`shell.exec\` n'est pas autorisee par la mission \`${mission.id}\`.`);
    const builtInOnlyCreateResult = await createTicket(rootDir, mission.id, [
        "--allow-capability",
        "fs.read",
        "--allow-capability",
        "cli.run",
    ]);
    strict_1.default.equal(builtInOnlyCreateResult.exitCode, 0);
    const builtInTicketId = String(builtInOnlyCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const builtInRunResult = await runCommand([
        "mission",
        "ticket",
        "run",
        "--root",
        rootDir,
        "--mission-id",
        mission.id,
        "--ticket-id",
        builtInTicketId,
    ]);
    strict_1.default.equal(builtInRunResult.exitCode, 0);
    strict_1.default.equal(launchCount, 1);
});
(0, node_test_1.default)("two-concurrent-extension-select-produces-no-intermediate-projection", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-extension-rewrite-under-lock-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    await registerCapability(rootDir);
    await registerSkillPack(rootDir);
    const mission = await createMission(rootDir);
    const projectionStoreModule = require("../../packages/storage/src/projection-store/file-projection-store");
    const originalWriteProjectionSnapshot = projectionStoreModule.writeProjectionSnapshot;
    const lockPath = node_path_1.default.join(rootDir, ".corp", "missions", mission.id, "mission.json.lock");
    const lockObservations = [];
    projectionStoreModule.writeProjectionSnapshot = async (...args) => {
        let lockPresent = true;
        try {
            await (0, promises_1.access)(lockPath);
        }
        catch {
            lockPresent = false;
        }
        lockObservations.push({ projection: args[1], lockPresent });
        return originalWriteProjectionSnapshot(...args);
    };
    t.after(() => {
        projectionStoreModule.writeProjectionSnapshot = originalWriteProjectionSnapshot;
    });
    const originalFindById = file_mission_repository_1.FileMissionRepository.prototype.findById;
    let synchronizedReads = 0;
    let releaseReads;
    const readBarrier = new Promise((resolve) => {
        releaseReads = resolve;
    });
    file_mission_repository_1.FileMissionRepository.prototype.findById = async function patchedFindById(missionId) {
        const foundMission = await originalFindById.call(this, missionId);
        if (missionId === mission.id && synchronizedReads < 2) {
            synchronizedReads += 1;
            if (synchronizedReads === 2) {
                releaseReads();
            }
            await readBarrier;
        }
        return foundMission;
    };
    t.after(() => {
        file_mission_repository_1.FileMissionRepository.prototype.findById = originalFindById;
    });
    const results = await Promise.all([
        selectMissionExtensions(rootDir, mission.id, ["--allow-capability", "shell.exec"]),
        selectMissionExtensions(rootDir, mission.id, ["--skill-pack", "pack.triage.local"]),
    ]);
    const successes = results.filter((result) => result.exitCode === 0);
    const failures = results.filter((result) => result.exitCode === 1);
    strict_1.default.equal(successes.length, 1);
    strict_1.default.equal(failures.length, 1);
    strict_1.default.ok(lockObservations.length > 0, "Au moins une projection devrait avoir ete ecrite par le gagnant.");
    for (const observation of lockObservations) {
        strict_1.default.equal(observation.lockPresent, true, `La projection ${observation.projection} a ete ecrite hors du lock saveIfUnchanged; rewrite non atomique.`);
    }
});
