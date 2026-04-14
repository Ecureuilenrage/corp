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
        "Mission ticket cancel",
        "--objective",
        "Annuler un ticket sans supprimer son historique",
        "--success-criterion",
        "L'annulation reste auditable",
        "--policy-profile",
        "policy_profile_local",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Mission creee: "));
    strict_1.default.ok(line, "la creation doit retourner un missionId");
    return line.slice("Mission creee: ".length);
}
async function createTicket(rootDir, missionId) {
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
        "Ticket a annuler",
        "--owner",
        "agent_dev",
        "--success-criterion",
        "Le ticket existe",
    ]);
    strict_1.default.equal(result.exitCode, 0);
    const line = result.lines.find((entry) => entry.startsWith("Ticket cree: "));
    strict_1.default.ok(line, "la creation doit retourner un ticketId");
    return line.slice("Ticket cree: ".length);
}
async function writeTicketStatus(rootDir, missionId, ticketId, status) {
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json");
    const ticket = JSON.parse(await (0, promises_1.readFile)(ticketPath, "utf8"));
    await (0, promises_1.writeFile)(ticketPath, `${JSON.stringify({ ...ticket, status }, null, 2)}\n`, "utf8");
}
(0, node_test_1.default)("l'aide mission expose mission ticket cancel en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission ticket cancel --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id>/);
    strict_1.default.match(output, /annule un ticket/i);
    strict_1.default.doesNotMatch(output, /codex|openai/i);
});
(0, node_test_1.default)("mission ticket cancel exige un mission-id et un ticket-id explicites", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-cancel-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    const missingMissionIdResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--ticket-id",
        ticketId,
    ]);
    strict_1.default.equal(missingMissionIdResult.exitCode, 1);
    strict_1.default.equal(missingMissionIdResult.lines.at(-1), "L'option --mission-id est obligatoire pour `corp mission ticket cancel`.");
    const missingTicketIdResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
    ]);
    strict_1.default.equal(missingTicketIdResult.exitCode, 1);
    strict_1.default.equal(missingTicketIdResult.lines.at(-1), "L'option --ticket-id est obligatoire pour `corp mission ticket cancel`.");
});
(0, node_test_1.default)("mission ticket cancel rejette les tickets inconnus et deja annules", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-cancel-guards-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    const unknownTicketResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        "ticket_inconnu",
    ]);
    strict_1.default.equal(unknownTicketResult.exitCode, 1);
    strict_1.default.equal(unknownTicketResult.lines.at(-1), `Ticket introuvable dans la mission \`${missionId}\`: \`ticket_inconnu\`.`);
    const firstCancelResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
    ]);
    strict_1.default.equal(firstCancelResult.exitCode, 0);
    const secondCancelResult = await runCommand([
        "mission",
        "ticket",
        "cancel",
        "--root",
        rootDir,
        "--mission-id",
        missionId,
        "--ticket-id",
        ticketId,
    ]);
    strict_1.default.equal(secondCancelResult.exitCode, 1);
    strict_1.default.equal(secondCancelResult.lines.at(-1), `Le ticket ${ticketId} est deja annule.`);
});
(0, node_test_1.default)("mission ticket cancel rejette done et failed sans muter les snapshots ni les projections", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-cancel-terminal-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    const missionPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "mission.json");
    const ticketPath = node_path_1.default.join(rootDir, ".corp", "missions", missionId, "tickets", ticketId, "ticket.json");
    const missionStatusPath = node_path_1.default.join(rootDir, ".corp", "projections", "mission-status.json");
    const ticketBoardPath = node_path_1.default.join(rootDir, ".corp", "projections", "ticket-board.json");
    const resumeViewPath = node_path_1.default.join(rootDir, ".corp", "projections", "resume-view.json");
    const journalPath = node_path_1.default.join(rootDir, ".corp", "journal", "events.jsonl");
    const cases = [
        {
            status: "done",
            expectedMessage: `Le ticket ${ticketId} est deja termine (statut: done).`,
        },
        {
            status: "failed",
            expectedMessage: `Le ticket ${ticketId} est deja en echec (statut: failed).`,
        },
    ];
    for (const testCase of cases) {
        await writeTicketStatus(rootDir, missionId, ticketId, testCase.status);
        const beforeMission = await (0, promises_1.readFile)(missionPath, "utf8");
        const beforeTicket = await (0, promises_1.readFile)(ticketPath, "utf8");
        const beforeMissionStatus = await (0, promises_1.readFile)(missionStatusPath, "utf8");
        const beforeTicketBoard = await (0, promises_1.readFile)(ticketBoardPath, "utf8");
        const beforeResumeView = await (0, promises_1.readFile)(resumeViewPath, "utf8");
        const beforeJournal = await (0, promises_1.readFile)(journalPath, "utf8");
        const result = await runCommand([
            "mission",
            "ticket",
            "cancel",
            "--root",
            rootDir,
            "--mission-id",
            missionId,
            "--ticket-id",
            ticketId,
        ]);
        strict_1.default.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.status}`);
        strict_1.default.equal(result.lines.at(-1), testCase.expectedMessage, `message inattendu pour ${testCase.status}`);
        strict_1.default.equal(await (0, promises_1.readFile)(missionPath, "utf8"), beforeMission);
        strict_1.default.equal(await (0, promises_1.readFile)(ticketPath, "utf8"), beforeTicket);
        strict_1.default.equal(await (0, promises_1.readFile)(missionStatusPath, "utf8"), beforeMissionStatus);
        strict_1.default.equal(await (0, promises_1.readFile)(ticketBoardPath, "utf8"), beforeTicketBoard);
        strict_1.default.equal(await (0, promises_1.readFile)(resumeViewPath, "utf8"), beforeResumeView);
        strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), beforeJournal);
    }
});
