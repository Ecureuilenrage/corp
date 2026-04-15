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
const event_log_errors_1 = require("../../packages/journal/src/event-log/event-log-errors");
const file_event_log_1 = require("../../packages/journal/src/event-log/file-event-log");
function createEvent(index) {
    return {
        eventId: `event_${index}`,
        type: "mission.created",
        missionId: "mission_event_log",
        occurredAt: "2026-04-15T10:00:00.000Z",
        actor: "operator",
        source: "test",
        payload: {
            index,
        },
    };
}
(0, node_test_1.default)("readEventLog parse le journal ligne-a-ligne et exporte le guard event", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-event-log-valid-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    await (0, promises_1.writeFile)(journalPath, `${JSON.stringify(createEvent(1))}\n${JSON.stringify(createEvent(2))}\n`, "utf8");
    const events = await (0, file_event_log_1.readEventLog)(journalPath);
    strict_1.default.equal(events.length, 2);
    strict_1.default.equal(events[0].eventId, "event_1");
    strict_1.default.equal((0, file_event_log_1.isJournalEventRecord)(events[1]), true);
});
(0, node_test_1.default)("readEventLog classe ENOENT comme journal_manquant avec action operateur", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-event-log-missing-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    await strict_1.default.rejects(() => (0, file_event_log_1.readEventLog)(journalPath), (error) => {
        strict_1.default.ok(error instanceof event_log_errors_1.EventLogReadError);
        strict_1.default.equal(error.code, "journal_manquant");
        strict_1.default.equal(error.journalPath, journalPath);
        strict_1.default.match(error.message, /journal_manquant/i);
        strict_1.default.match(error.message, /relancez.*bootstrap|restaurez le journal/i);
        return true;
    });
});
(0, node_test_1.default)("readEventLog indique la ligne JSON corrompue sans SyntaxError brut", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-event-log-json-invalid-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    await (0, promises_1.writeFile)(journalPath, `${JSON.stringify(createEvent(1))}\n{json invalide\n`, "utf8");
    await strict_1.default.rejects(() => (0, file_event_log_1.readEventLog)(journalPath), (error) => {
        strict_1.default.ok(error instanceof event_log_errors_1.EventLogReadError);
        strict_1.default.equal(error.code, "journal_invalide");
        strict_1.default.equal(error.lineNumber, 2);
        strict_1.default.match(error.message, /ligne 2/);
        strict_1.default.doesNotMatch(error.message, /SyntaxError/);
        return true;
    });
});
(0, node_test_1.default)("readEventLog rejette une ligne event valide JSON mais schema invalide", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-event-log-schema-invalid-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    await (0, promises_1.writeFile)(journalPath, `${JSON.stringify({ ...createEvent(1), payload: null })}\n`, "utf8");
    await strict_1.default.rejects(() => (0, file_event_log_1.readEventLog)(journalPath), (error) => {
        strict_1.default.ok(error instanceof event_log_errors_1.EventLogReadError);
        strict_1.default.equal(error.code, "journal_invalide");
        strict_1.default.equal(error.lineNumber, 1);
        strict_1.default.match(error.message, /schema invalide|type incorrect/i);
        return true;
    });
});
(0, node_test_1.default)("ensureAppendOnlyEventLog tronque seulement une derniere ligne clairement incomplete", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-event-log-truncated-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    const validLine = `${JSON.stringify(createEvent(1))}\n`;
    await (0, promises_1.writeFile)(journalPath, `${validLine}{"eventId":"event_truncated"`, "utf8");
    const created = await (0, file_event_log_1.ensureAppendOnlyEventLog)(journalPath);
    const contents = await (0, promises_1.readFile)(journalPath, "utf8");
    strict_1.default.equal(created, false);
    strict_1.default.equal(contents, validLine);
    strict_1.default.equal((await (0, file_event_log_1.readEventLog)(journalPath)).length, 1);
});
(0, node_test_1.default)("ensureAppendOnlyEventLog garde une ligne complete semantiquement invalide en erreur explicite", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-event-log-complete-invalid-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    const contents = `${JSON.stringify(createEvent(1))}\n${JSON.stringify({ eventId: "event_invalid" })}\n`;
    await (0, promises_1.writeFile)(journalPath, contents, "utf8");
    await strict_1.default.rejects(() => (0, file_event_log_1.ensureAppendOnlyEventLog)(journalPath), (error) => {
        strict_1.default.ok(error instanceof event_log_errors_1.EventLogReadError);
        strict_1.default.equal(error.code, "journal_invalide");
        strict_1.default.equal(error.lineNumber, 2);
        return true;
    });
    strict_1.default.equal(await (0, promises_1.readFile)(journalPath, "utf8"), contents);
});
(0, node_test_1.default)("normalizeEventLogReadError conserve le code OS et le chemin", () => {
    const journalPath = "C:/tmp/events.jsonl";
    const errno = Object.assign(new Error("permission denied"), { code: "EACCES" });
    const error = (0, event_log_errors_1.normalizeEventLogReadError)(errno, journalPath);
    strict_1.default.ok(error instanceof event_log_errors_1.EventLogReadError);
    strict_1.default.equal(error.code, "erreur_fichier");
    strict_1.default.equal(error.osCode, "EACCES");
    strict_1.default.equal(error.journalPath, journalPath);
    strict_1.default.match(error.message, /EACCES/);
    strict_1.default.match(error.message, /events\.jsonl/);
});
