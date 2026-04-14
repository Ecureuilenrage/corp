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
        "Mission ticket update",
        "--objective",
        "Faire evoluer un ticket sans casser l'historique",
        "--success-criterion",
        "Les mutations sont explicites",
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
        "Livrer la delegation initiale",
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
(0, node_test_1.default)("l'aide mission expose mission ticket update en francais sans fuite vendor", async () => {
    const result = await runCommand(["mission", "help"]);
    const output = result.lines.join("\n");
    strict_1.default.equal(result.exitCode, 0);
    strict_1.default.match(output, /corp mission ticket update --root <workspace> --mission-id <mission_id> --ticket-id <ticket_id>/);
    strict_1.default.match(output, /met a jour un ticket/i);
    strict_1.default.doesNotMatch(output, /codex|openai/i);
});
(0, node_test_1.default)("mission ticket update valide les gardes de surface principales", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-update-validation-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await bootstrapWorkspace(rootDir);
    const missionId = await createMission(rootDir);
    const ticketId = await createTicket(rootDir, missionId);
    const cases = [
        {
            name: "mission-id manquant",
            args: [
                "mission",
                "ticket",
                "update",
                "--root",
                rootDir,
                "--ticket-id",
                ticketId,
                "--goal",
                "Nouveau goal",
            ],
            expectedMessage: "L'option --mission-id est obligatoire pour `corp mission ticket update`.",
        },
        {
            name: "ticket-id manquant",
            args: [
                "mission",
                "ticket",
                "update",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--goal",
                "Nouveau goal",
            ],
            expectedMessage: "L'option --ticket-id est obligatoire pour `corp mission ticket update`.",
        },
        {
            name: "aucune mutation demandee",
            args: [
                "mission",
                "ticket",
                "update",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--ticket-id",
                ticketId,
            ],
            expectedMessage: "Aucune mutation demandee pour `corp mission ticket update`.",
        },
        {
            name: "depends-on et clear-depends-on incompatibles",
            args: [
                "mission",
                "ticket",
                "update",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--ticket-id",
                ticketId,
                "--depends-on",
                "ticket_autre",
                "--clear-depends-on",
            ],
            expectedMessage: "Les options `--depends-on` et `--clear-depends-on` sont incompatibles pour `corp mission ticket update`.",
        },
        {
            name: "allow-capability et clear-allow-capability incompatibles",
            args: [
                "mission",
                "ticket",
                "update",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--ticket-id",
                ticketId,
                "--allow-capability",
                "fs.read",
                "--clear-allow-capability",
            ],
            expectedMessage: "Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission ticket update`.",
        },
        {
            name: "skill-pack et clear-skill-pack incompatibles",
            args: [
                "mission",
                "ticket",
                "update",
                "--root",
                rootDir,
                "--mission-id",
                missionId,
                "--ticket-id",
                ticketId,
                "--skill-pack",
                "pack.core",
                "--clear-skill-pack",
            ],
            expectedMessage: "Les options `--skill-pack` et `--clear-skill-pack` sont incompatibles pour `corp mission ticket update`.",
        },
    ];
    for (const testCase of cases) {
        const result = await runCommand(testCase.args);
        strict_1.default.equal(result.exitCode, 1, `exit code inattendu pour ${testCase.name}`);
        strict_1.default.equal(result.lines.at(-1), testCase.expectedMessage, `message inattendu pour ${testCase.name}`);
    }
});
(0, node_test_1.default)("mission ticket update rejette claimed et in_progress sans muter l'etat", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-cli-ticket-update-guards-"));
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
            status: "claimed",
            expectedMessage: `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: claimed). `
                + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
        },
        {
            status: "in_progress",
            expectedMessage: `Le ticket ${ticketId} ne peut pas etre modifie dans son statut actuel (statut: in_progress). `
                + "Seuls les tickets en statut todo peuvent etre mis a jour via `ticket update`.",
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
            "update",
            "--root",
            rootDir,
            "--mission-id",
            missionId,
            "--ticket-id",
            ticketId,
            "--goal",
            "Nouveau goal contractuel",
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
