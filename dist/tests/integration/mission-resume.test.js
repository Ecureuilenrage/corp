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
async function createMission(rootDir) {
    const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
    strict_1.default.equal(bootstrapResult.exitCode, 0);
    const createResult = await runCommand([
        "mission",
        "create",
        "--root",
        rootDir,
        "--title",
        "Mission reprise",
        "--objective",
        "Retrouver l'etat courant sans relire le transcript",
        "--success-criterion",
        "L'operateur voit l'objectif courant",
        "--success-criterion",
        "Les sections vides restent explicites",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(createResult.exitCode, 0);
    const missionCreatedLine = createResult.lines.find((line) => line.startsWith("Mission creee: "));
    strict_1.default.ok(missionCreatedLine, "la creation doit retourner un missionId");
    const missionId = missionCreatedLine.slice("Mission creee: ".length);
    const journalEntries = (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
    return {
        missionId,
        lastEventId: String(journalEntries.at(-1)?.eventId),
    };
}
(0, node_test_1.default)("mission status et mission resume restituent un resume operateur scannable", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId, lastEventId } = await createMission(rootDir);
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    for (const result of [statusResult, resumeResult]) {
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, new RegExp(`Mission: ${missionId}`));
        strict_1.default.match(output, /Titre: Mission reprise/);
        strict_1.default.match(output, /Objectif: Retrouver l'etat courant sans relire le transcript/);
        strict_1.default.match(output, /Statut: ready/);
        strict_1.default.match(output, /Criteres de succes:/);
        strict_1.default.match(output, /1\. L'operateur voit l'objectif courant/);
        strict_1.default.match(output, /2\. Les sections vides restent explicites/);
        strict_1.default.match(output, /Tickets ouverts: aucun/);
        strict_1.default.match(output, /Validations en attente: aucune/);
        strict_1.default.match(output, /Dernier artefact pertinent: aucun/);
        strict_1.default.match(output, /Dernier blocage connu: aucun/);
        strict_1.default.match(output, new RegExp(`Dernier evenement: ${lastEventId}`));
        strict_1.default.match(output, /Prochain arbitrage utile: Aucun ticket n'existe encore\./);
        strict_1.default.doesNotMatch(output, /codex|openai|response_id|thread_id/i);
    }
});
(0, node_test_1.default)("mission resume expose le diagnostic journal_invalide quand le journal est illisible", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-invalid-journal-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    await (0, promises_1.writeFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "{json invalide\n", "utf8");
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 1);
    strict_1.default.match(result.lines.at(-1) ?? "", /journal_invalide: journal append-only invalide a la ligne 1 .*JSON corrompu\./);
    strict_1.default.doesNotMatch(result.lines.at(-1) ?? "", /SyntaxError|Journal mission irreconciliable/);
});
(0, node_test_1.default)("mission status et mission resume restent strictement read-only pour le journal", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-read-only-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const beforeRead = await (0, promises_1.readFile)(journalPath, "utf8");
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const afterRead = await (0, promises_1.readFile)(journalPath, "utf8");
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.equal(afterRead, beforeRead);
});
(0, node_test_1.default)("mission resume reconstruit resume-view quand la projection est absente", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-missing-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId, lastEventId } = await createMission(rootDir);
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    await (0, promises_1.unlink)(resumeViewPath);
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), /Prochain arbitrage utile: Aucun ticket n'existe encore\./);
    const reconstructedProjection = await readJson(resumeViewPath);
    strict_1.default.deepEqual(reconstructedProjection, {
        schemaVersion: 1,
        resume: {
            missionId,
            title: "Mission reprise",
            objective: "Retrouver l'etat courant sans relire le transcript",
            status: "ready",
            successCriteria: [
                "L'operateur voit l'objectif courant",
                "Les sections vides restent explicites",
            ],
            authorizedExtensions: {
                allowedCapabilities: [],
                skillPackRefs: [],
            },
            openTickets: [],
            pendingApprovals: [],
            lastRelevantArtifact: null,
            lastKnownBlockage: null,
            lastEventId,
            updatedAt: String(reconstructedProjection.resume.updatedAt),
            nextOperatorAction: "Aucun ticket n'existe encore. La prochaine etape probable releve de la suite Epic 1 / Epic 2.",
        },
    });
});
(0, node_test_1.default)("mission status reconstruit resume-view stale avant affichage", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-stale-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId, lastEventId } = await createMission(rootDir);
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    await (0, promises_1.writeFile)(resumeViewPath, JSON.stringify({
        schemaVersion: 1,
        resume: {
            missionId,
            title: "Mission reprise",
            objective: "Obsolete",
            status: "ready",
            successCriteria: [],
            openTickets: [],
            pendingApprovals: [],
            lastRelevantArtifact: null,
            lastEventId: "event_obsolete",
            updatedAt: "2026-01-01T00:00:00.000Z",
            nextOperatorAction: "Obsolete",
        },
    }, null, 2), "utf8");
    const result = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
    strict_1.default.doesNotMatch(result.lines.join("\n"), /event_obsolete/);
    const reconstructedProjection = await readJson(resumeViewPath);
    const reconstructedResume = reconstructedProjection.resume;
    strict_1.default.equal(reconstructedResume.lastEventId, lastEventId);
    strict_1.default.equal(reconstructedResume.nextOperatorAction, "Aucun ticket n'existe encore. La prochaine etape probable releve de la suite Epic 1 / Epic 2.");
    strict_1.default.ok("lastKnownBlockage" in reconstructedResume, "le snapshot reconstruit doit contenir lastKnownBlockage meme si l'ancien n'en avait pas");
    strict_1.default.equal(reconstructedResume.lastKnownBlockage, null, "lastKnownBlockage doit etre null quand la mission ready n'a aucun blocage");
});
(0, node_test_1.default)("mission resume reconstruit resume-view quand le schemaVersion est inattendu", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-schema-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId, lastEventId } = await createMission(rootDir);
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    await (0, promises_1.writeFile)(resumeViewPath, JSON.stringify({ schemaVersion: 99, resume: null }, null, 2), "utf8");
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
    const reconstructed = await readJson(resumeViewPath);
    strict_1.default.equal(reconstructed.schemaVersion, 1);
});
(0, node_test_1.default)("mission resume reconstruit resume-view quand le missionId ne correspond pas", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-wrong-id-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId, lastEventId } = await createMission(rootDir);
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const originalProjection = await readJson(resumeViewPath);
    const originalResume = originalProjection.resume;
    await (0, promises_1.writeFile)(resumeViewPath, JSON.stringify({
        schemaVersion: 1,
        resume: { ...originalResume, missionId: "mission_autre" },
    }, null, 2), "utf8");
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), new RegExp(`Mission: ${missionId}`));
    strict_1.default.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
});
(0, node_test_1.default)("mission resume reconstruit resume-view quand resume est null dans un fichier valide", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-null-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId, lastEventId } = await createMission(rootDir);
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    await (0, promises_1.writeFile)(resumeViewPath, JSON.stringify({ schemaVersion: 1, resume: null }, null, 2), "utf8");
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), new RegExp(`Mission: ${missionId}`));
    strict_1.default.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
    const reconstructed = await readJson(resumeViewPath);
    const reconstructedResume = reconstructed.resume;
    strict_1.default.equal(reconstructedResume.missionId, missionId);
    strict_1.default.equal(reconstructedResume.lastEventId, lastEventId);
});
(0, node_test_1.default)("mission resume reconstruit un resume lifecycle depuis le journal si resume-view est corrompu", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-lifecycle-"));
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
    const journalEntries = (await (0, promises_1.readFile)(node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl"), "utf8"))
        .split("\n")
        .filter((line) => line.trim().length > 0)
        .map((line) => JSON.parse(line));
    const lastEventId = String(journalEntries.at(-1)?.eventId);
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    await (0, promises_1.writeFile)(resumeViewPath, "{corrupted", "utf8");
    const result = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(result.lines.join("\n"), /Statut: blocked/);
    strict_1.default.match(result.lines.join("\n"), /Dernier blocage connu: Mission mise en pause/);
    strict_1.default.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
    strict_1.default.match(result.lines.join("\n"), /Prochain arbitrage utile: Mission bloquee\. Relancez-la quand les conditions de reprise sont reunies\./);
    const reconstructedProjection = await readJson(resumeViewPath);
    strict_1.default.deepEqual(reconstructedProjection, {
        schemaVersion: 1,
        resume: {
            missionId,
            title: "Mission reprise",
            objective: "Retrouver l'etat courant sans relire le transcript",
            status: "blocked",
            successCriteria: [
                "L'operateur voit l'objectif courant",
                "Les sections vides restent explicites",
            ],
            authorizedExtensions: {
                allowedCapabilities: [],
                skillPackRefs: [],
            },
            openTickets: [],
            pendingApprovals: [],
            lastRelevantArtifact: null,
            lastKnownBlockage: {
                kind: "mission_lifecycle",
                summary: "Mission mise en pause",
                missionStatus: "blocked",
                occurredAt: String(reconstructedProjection.resume.updatedAt),
                reasonCode: "mission_paused",
                sourceEventId: lastEventId,
            },
            lastEventId,
            updatedAt: String(reconstructedProjection.resume.updatedAt),
            nextOperatorAction: "Mission bloquee. Relancez-la quand les conditions de reprise sont reunies.",
        },
    });
});
(0, node_test_1.default)("mission status et mission resume exposent immediatement le ticket ouvert cree", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-ticket-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Livrer une delegation traquable",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket apparait au resume",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketCreatedLine = ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "));
    strict_1.default.ok(ticketCreatedLine, "la creation doit retourner un ticketId");
    const ticketId = ticketCreatedLine.slice("Ticket cree: ".length);
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    for (const result of [statusResult, resumeResult]) {
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, new RegExp(`Mission: ${missionId}`));
        strict_1.default.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
        strict_1.default.doesNotMatch(output, /Tickets ouverts: aucun/);
        strict_1.default.doesNotMatch(output, /Aucun ticket n'existe encore/);
        strict_1.default.match(output, /Prochain arbitrage utile: Traitez le prochain ticket runnable: Livrer une delegation traquable\./);
    }
});
(0, node_test_1.default)("mission status devient la vue detaillee tandis que mission resume reste compacte", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-status-detailed-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Afficher un board detaille",
        "--owner",
        "agent_status",
        "--success-criterion",
        "Le ticket apparait dans la supervision detaillee",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const statusResult = await runCommand([
        "mission",
        "status",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const statusOutput = statusResult.lines.join("\n");
    const resumeOutput = resumeResult.lines.join("\n");
    strict_1.default.equal(statusResult.exitCode, 0);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(statusOutput, /Etat des tickets:/);
    strict_1.default.match(statusOutput, new RegExp(`${ticketId} \\| statut=todo \\| owner=agent_status`));
    strict_1.default.match(statusOutput, /motif=pret a lancer/);
    strict_1.default.doesNotMatch(statusOutput, /codex|openai|response_id|thread_id/i);
    strict_1.default.doesNotMatch(resumeOutput, /Etat des tickets:/);
    strict_1.default.doesNotMatch(resumeOutput, new RegExp(`${ticketId} \\| statut=todo`));
    strict_1.default.match(resumeOutput, new RegExp(`Tickets ouverts: ${ticketId}`));
});
(0, node_test_1.default)("readMissionStatus ne lit le ticket-board qu'une seule fois", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-status-single-board-read-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Verifier la lecture unique du board",
        "--owner",
        "agent_status",
        "--success-criterion",
        "Le board est lu une seule fois",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const readTicketBoardModule = require("../../packages/ticket-runtime/src/planner/read-ticket-board");
    const readMissionStatusModule = require("../../packages/mission-kernel/src/resume-service/read-mission-status");
    const originalReadTicketBoard = readTicketBoardModule.readTicketBoard;
    let readTicketBoardCallCount = 0;
    readTicketBoardModule.readTicketBoard = async (...args) => {
        readTicketBoardCallCount += 1;
        return originalReadTicketBoard(...args);
    };
    t.after(() => {
        readTicketBoardModule.readTicketBoard = originalReadTicketBoard;
    });
    const statusResult = await readMissionStatusModule.readMissionStatus({
        rootDir,
        missionId,
    });
    strict_1.default.equal(readTicketBoardCallCount, 1);
    strict_1.default.equal(statusResult.resume.missionId, missionId);
    strict_1.default.equal(statusResult.ticketBoard.tickets.length, 1);
    strict_1.default.equal(statusResult.resume.openTickets.length, 1);
    strict_1.default.equal(statusResult.ticketBoard.tickets[0]?.ticketId, statusResult.resume.openTickets[0]?.ticketId);
});
(0, node_test_1.default)("mission resume privilegie le premier ticket runnable plutot que le premier ticket ouvert", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-runnable-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const prerequisiteResult = await runCommand([
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
        "Verifier le prerequis runnable",
        "--owner",
        "agent_pre",
        "--success-criterion",
        "Le prerequis est visible",
    ]);
    const dependentResult = await runCommand([
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
        "Ticket dependant non runnable",
        "--owner",
        "agent_dep",
        "--depends-on",
        String(prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length)),
        "--success-criterion",
        "Le dependent est visible",
    ]);
    strict_1.default.equal(prerequisiteResult.exitCode, 0);
    strict_1.default.equal(dependentResult.exitCode, 0);
    const prerequisiteTicketId = String(prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const dependentTicketId = String(dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const moveResult = await runCommand([
        "mission",
        "ticket",
        "move",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        dependentTicketId,
        "--to-front",
    ]);
    strict_1.default.equal(moveResult.exitCode, 0);
    for (const commandName of ["status", "resume"]) {
        const result = await runCommand([
            "mission",
            commandName,
            "--root",
            rootDir,
            "--mission-id",
            missionId,
        ]);
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, new RegExp(`Tickets ouverts: ${dependentTicketId}, ${prerequisiteTicketId}`));
        strict_1.default.match(output, /Prochain arbitrage utile: Traitez le prochain ticket runnable: Verifier le prerequis runnable\./);
    }
});
(0, node_test_1.default)("mission resume oriente vers la replanification quand aucun ticket ouvert n'est runnable", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-replan-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const prerequisiteResult = await runCommand([
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
        "Prerequis a annuler",
        "--owner",
        "agent_pre",
        "--success-criterion",
        "Le prerequis existe",
    ]);
    strict_1.default.equal(prerequisiteResult.exitCode, 0);
    const prerequisiteTicketId = String(prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const dependentResult = await runCommand([
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
        "Dependent bloque",
        "--owner",
        "agent_dep",
        "--depends-on",
        prerequisiteTicketId,
        "--success-criterion",
        "Le dependent existe",
    ]);
    strict_1.default.equal(dependentResult.exitCode, 0);
    const dependentTicketId = String(dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const cancelResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        prerequisiteTicketId,
    ]);
    strict_1.default.equal(cancelResult.exitCode, 0);
    for (const commandName of ["status", "resume"]) {
        const result = await runCommand([
            "mission",
            commandName,
            "--root",
            rootDir,
            "--mission-id",
            missionId,
        ]);
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, new RegExp(`Tickets ouverts: ${dependentTicketId}`));
        strict_1.default.doesNotMatch(output, new RegExp(`Tickets ouverts: .*${prerequisiteTicketId}`));
        strict_1.default.match(output, /Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment\. Replanifiez ou debloquez la mission avant de poursuivre\./);
    }
});
(0, node_test_1.default)("mission resume expose un blocage ticket_blocked quand un ticket est bloque par dependance", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-ticket-blocked-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const prerequisiteResult = await runCommand([
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
        "Prerequis a annuler pour bloquer",
        "--owner",
        "agent_pre",
        "--success-criterion",
        "Le prerequis existe",
    ]);
    strict_1.default.equal(prerequisiteResult.exitCode, 0);
    const prerequisiteTicketId = String(prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const dependentResult = await runCommand([
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
        "Dependent bloque par annulation",
        "--owner",
        "agent_dep",
        "--depends-on",
        prerequisiteTicketId,
        "--success-criterion",
        "Le dependent est bloque",
    ]);
    strict_1.default.equal(dependentResult.exitCode, 0);
    const dependentTicketId = String(dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const cancelResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        prerequisiteTicketId,
    ]);
    strict_1.default.equal(cancelResult.exitCode, 0);
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const output = resumeResult.lines.join("\n");
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(output, new RegExp(`Dernier blocage connu: Ticket ${dependentTicketId} bloque \\| ticket=${dependentTicketId}`));
    strict_1.default.match(output, /raison=dependance annulee/);
    strict_1.default.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_action/i);
    const resumeView = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    const blockage = resumeView.resume?.lastKnownBlockage;
    strict_1.default.ok(blockage);
    strict_1.default.equal(blockage.kind, "ticket_blocked");
    strict_1.default.equal(blockage.ticketId, dependentTicketId);
    strict_1.default.equal(blockage.reasonCode, "dependency_cancelled");
    strict_1.default.equal(blockage.sourceEventId, null);
});
(0, node_test_1.default)("mission resume oriente vers le suivi d'un ticket en cours apres mission ticket run", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-running-ticket-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async () => ({
                status: "requested",
                adapterState: {
                    responseId: "resp_resume_running",
                    pollCursor: "cursor_resume_running",
                    vendorStatus: "queued",
                },
            }),
        }),
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Suivre un ticket deja parti",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket peut etre lance",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
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
    for (const commandName of ["status", "resume"]) {
        const result = await runCommand([
            "mission",
            commandName,
            "--root",
            rootDir,
            "--mission-id",
            missionId,
        ]);
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, /Statut: running/);
        strict_1.default.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
        strict_1.default.match(output, /Dernier blocage connu: aucun/);
        strict_1.default.match(output, /Prochain arbitrage utile: Suivez le ticket en cours: Suivre un ticket deja parti\./);
        strict_1.default.doesNotMatch(output, /Aucun ticket n'est runnable pour le moment/);
        strict_1.default.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_approval/i);
    }
    const resumeView = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    strict_1.default.equal(resumeView.resume?.lastKnownBlockage, null);
    strict_1.default.equal(resumeView.resume?.nextOperatorAction, "Suivez le ticket en cours: Suivre un ticket deja parti.");
});
(0, node_test_1.default)("mission resume privilegie une validation en attente sur le suivi d'un ticket en cours", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-pending-approval-"));
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
                    responseId: "resp_resume_approval",
                    pollCursor: "cursor_resume_approval",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation critique",
                    actionType: "workspace_write",
                    actionSummary: "Ecriture sensible dans le workspace",
                    guardrails: ["manual_review: workspace_write"],
                },
            }),
        }),
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Attendre une validation explicite",
        "--owner",
        "agent_approval",
        "--success-criterion",
        "Le ticket peut etre arbitre",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
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
    for (const commandName of ["status", "resume"]) {
        const result = await runCommand([
            "mission",
            commandName,
            "--root",
            rootDir,
            "--mission-id",
            missionId,
        ]);
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, /Statut: awaiting_approval/);
        strict_1.default.match(output, /Validations en attente: approval_/);
        strict_1.default.match(output, new RegExp(`Dernier blocage connu: Validation en attente pour le ticket ${ticketId}: Ecriture sensible dans le workspace \\| validation=approval_`));
        strict_1.default.match(output, /Prochain arbitrage utile: Arbitrez la prochaine validation en attente: Validation critique\./);
        strict_1.default.doesNotMatch(output, /Suivez le ticket en cours/);
        strict_1.default.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_approval/i);
    }
    const resumeView = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    const blockage = resumeView.resume?.lastKnownBlockage;
    strict_1.default.ok(blockage);
    strict_1.default.equal(blockage.kind, "approval_pending");
    strict_1.default.equal(blockage.ticketId, ticketId);
    strict_1.default.equal(blockage.reasonCode, "approval_requested");
    strict_1.default.match(String(blockage.approvalId), /^approval_/);
    strict_1.default.match(String(blockage.attemptId), /^attempt_/);
    strict_1.default.match(String(blockage.sourceEventId), /^event_/);
    strict_1.default.doesNotMatch(JSON.stringify(blockage), /responseId|pollCursor|vendorStatus|requires_approval/i);
});
(0, node_test_1.default)("mission resume reecrit un resume enrichi quand resume-view est ancien et approval-queue stale", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-stale-upstream-"));
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
                    responseId: "resp_resume_stale",
                    pollCursor: "cursor_resume_stale",
                    vendorStatus: "requires_approval",
                },
                approvalRequest: {
                    title: "Validation stale",
                    actionType: "workspace_write",
                    actionSummary: "Ecriture sensible apres reconstruction",
                    guardrails: ["manual_review: workspace_write"],
                },
            }),
        }),
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Retrouver le resume enrichi",
        "--owner",
        "agent_stale",
        "--success-criterion",
        "Le resume est reecrit",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
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
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const approvalQueuePath = node_path_1.default.join(rootDir, ".corp", "projections", "approval-queue.json");
    const staleResumeView = await readJson(resumeViewPath);
    await (0, promises_1.writeFile)(resumeViewPath, JSON.stringify({
        schemaVersion: 1,
        resume: {
            ...staleResumeView.resume,
            pendingApprovals: [],
            nextOperatorAction: "Obsolete",
        },
    }, null, 2), "utf8");
    await (0, promises_1.writeFile)(approvalQueuePath, "{corrupted", "utf8");
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const reconstructedResumeView = await readJson(resumeViewPath);
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(resumeResult.lines.join("\n"), new RegExp(`Dernier blocage connu: Validation en attente pour le ticket ${ticketId}: Ecriture sensible apres reconstruction \\| validation=approval_`));
    strict_1.default.equal(reconstructedResumeView.resume?.lastKnownBlockage?.kind, "approval_pending");
    strict_1.default.match(String(reconstructedResumeView.resume?.pendingApprovals[0]?.approvalId), /^approval_/);
    strict_1.default.equal(reconstructedResumeView.resume?.nextOperatorAction, "Arbitrez la prochaine validation en attente: Validation stale.");
});
(0, node_test_1.default)("mission resume exclut les tickets failed des tickets ouverts et oriente vers la replanification", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-failed-ticket-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Ticket echoue a replanifier",
        "--owner",
        "agent_failed",
        "--success-criterion",
        "Le ticket existe",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json");
    const ticket = await readJson(ticketPath);
    await (0, promises_1.writeFile)(ticketPath, JSON.stringify({
        ...ticket,
        status: "failed",
        updatedAt: "2026-04-10T10:10:10.000Z",
    }, null, 2), "utf8");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    await (0, promises_1.unlink)(resumeViewPath);
    for (const commandName of ["status", "resume"]) {
        const result = await runCommand([
            "mission",
            commandName,
            "--root",
            rootDir,
            "--mission-id",
            missionId,
        ]);
        const output = result.lines.join("\n");
        strict_1.default.equal(result.exitCode, 0);
        strict_1.default.match(output, /Tickets ouverts: aucun/);
        strict_1.default.doesNotMatch(output, new RegExp(`Tickets ouverts: .*${ticketId}`));
        strict_1.default.match(output, /Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment\. Replanifiez ou debloquez la mission avant de poursuivre\./);
        strict_1.default.doesNotMatch(output, /Aucun ticket n'existe encore/);
    }
    const resumeView = await readJson(resumeViewPath);
    const openTickets = (resumeView.resume?.openTickets ?? []);
    strict_1.default.deepEqual(openTickets, []);
    strict_1.default.equal(resumeView.resume?.nextOperatorAction, "Aucun ticket n'est runnable pour le moment. Replanifiez ou debloquez la mission avant de poursuivre.");
});
(0, node_test_1.default)("mission resume expose un blocage ticket_failed tout en preservant le dernier artefact utile", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-failed-artifact-"));
    t.after(async () => {
        (0, run_ticket_1.setRunTicketDependenciesForTesting)(null);
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    (0, run_ticket_1.setRunTicketDependenciesForTesting)({
        createAdapter: () => ({
            id: "codex_responses",
            launch: async ({ workspacePath }) => {
                await (0, promises_1.writeFile)(node_path_1.default.join(workspacePath, "README.md"), "resume failure\n", "utf8");
                throw new Error("adapter boom");
            },
        }),
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Produire un artefact avant echec",
        "--owner",
        "agent_failed_artifact",
        "--success-criterion",
        "Le dernier artefact reste visible",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
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
    ]);
    strict_1.default.equal(runResult.exitCode, 1);
    strict_1.default.equal(runResult.lines.at(-1), "adapter boom");
    const resumeResult = await runCommand([
        "mission",
        "resume",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    const resumeView = await readJson(node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json"));
    const blockage = resumeView.resume?.lastKnownBlockage;
    const artifact = resumeView.resume?.lastRelevantArtifact;
    strict_1.default.equal(resumeResult.exitCode, 0);
    strict_1.default.match(resumeResult.lines.join("\n"), new RegExp(`Dernier blocage connu: Ticket ${ticketId} en echec \\| ticket=${ticketId} \\| tentative=attempt_.* \\| raison=ticket en echec`));
    strict_1.default.match(resumeResult.lines.join("\n"), /Dernier artefact pertinent: .*README\.md/);
    strict_1.default.ok(blockage);
    strict_1.default.equal(blockage.kind, "ticket_failed");
    strict_1.default.equal(blockage.ticketId, ticketId);
    strict_1.default.equal(blockage.reasonCode, "ticket_failed");
    strict_1.default.match(String(blockage.attemptId), /^attempt_/);
    strict_1.default.match(String(blockage.sourceEventId), /^event_/);
    strict_1.default.ok(artifact);
    strict_1.default.equal(artifact.path, "README.md");
});
(0, node_test_1.default)("mission resume reconstruit depuis le journal quand un snapshot ticket porte un statut fantome", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-mission-resume-ghost-statuses-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const { missionId } = await createMission(rootDir);
    const ticketCreateResult = await runCommand([
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
        "Ticket au statut fantome",
        "--owner",
        "agent_ghost",
        "--success-criterion",
        "Le ticket existe",
    ]);
    strict_1.default.equal(ticketCreateResult.exitCode, 0);
    const ticketId = String(ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length));
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const ticket = await readJson(ticketPath);
    for (const ghostStatus of ["completed", "closed"]) {
        await (0, promises_1.writeFile)(ticketPath, JSON.stringify({
            ...ticket,
            status: ghostStatus,
            updatedAt: `2026-04-10T10:10:${ghostStatus === "completed" ? "10" : "20"}.000Z`,
        }, null, 2), "utf8");
        await (0, promises_1.unlink)(resumeViewPath);
        for (const commandName of ["status", "resume"]) {
            const result = await runCommand([
                "mission",
                commandName,
                "--root",
                rootDir,
                "--mission-id",
                missionId,
            ]);
            const output = result.lines.join("\n");
            strict_1.default.equal(result.exitCode, 0);
            strict_1.default.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
            strict_1.default.doesNotMatch(output, /Tickets ouverts: aucun/);
            strict_1.default.match(output, /Prochain arbitrage utile: Traitez le prochain ticket runnable: Ticket au statut fantome\./);
            strict_1.default.doesNotMatch(output, new RegExp(`statut=${ghostStatus}`));
        }
        const resumeView = await readJson(resumeViewPath);
        strict_1.default.equal(resumeView.resume?.openTickets[0]?.ticketId, ticketId);
        strict_1.default.equal(resumeView.resume?.openTickets[0]?.status, "todo");
    }
});
