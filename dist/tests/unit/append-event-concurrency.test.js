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
const append_event_1 = require("../../packages/journal/src/event-log/append-event");
function buildEvent(index, missionId) {
    return {
        eventId: `event_${String(index).padStart(4, "0")}`,
        type: "test.concurrent_append",
        missionId,
        occurredAt: new Date(1_700_000_000_000 + index).toISOString(),
        actor: "test",
        source: "unit",
        payload: {
            index,
            // Charge utile volumineuse pour augmenter la probabilite d'entrelacement
            // en cas d'appendFile non serialise.
            filler: "x".repeat(512),
        },
    };
}
(0, node_test_1.default)("appendEvent serialise 10 appends concurrents sur le meme journal sans ligne tronquee", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-append-event-concurrent-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    await (0, promises_1.writeFile)(journalPath, "", "utf8");
    const concurrentCount = 10;
    const missionId = "mission_concurrent";
    const appendPromises = Array.from({ length: concurrentCount }, (_, index) => (0, append_event_1.appendEvent)(journalPath, buildEvent(index, missionId)));
    await Promise.all(appendPromises);
    const content = await (0, promises_1.readFile)(journalPath, "utf8");
    const lines = content.split("\n").filter((line) => line.length > 0);
    strict_1.default.equal(lines.length, concurrentCount);
    const seenIndexes = new Set();
    for (const line of lines) {
        const parsed = JSON.parse(line);
        strict_1.default.equal(parsed.missionId, missionId);
        strict_1.default.equal(parsed.payload?.filler?.length, 512);
        strict_1.default.equal(typeof parsed.payload?.index, "number");
        seenIndexes.add(parsed.payload.index);
    }
    strict_1.default.equal(seenIndexes.size, concurrentCount);
});
(0, node_test_1.default)("appendEvent serialise les appends par chemin sans bloquer les autres journaux", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-append-event-multi-path-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPathA = node_path_1.default.join(rootDir, "events-a.jsonl");
    const journalPathB = node_path_1.default.join(rootDir, "events-b.jsonl");
    await (0, promises_1.writeFile)(journalPathA, "", "utf8");
    await (0, promises_1.writeFile)(journalPathB, "", "utf8");
    await Promise.all([
        ...Array.from({ length: 5 }, (_, index) => (0, append_event_1.appendEvent)(journalPathA, buildEvent(index, "mission_a"))),
        ...Array.from({ length: 5 }, (_, index) => (0, append_event_1.appendEvent)(journalPathB, buildEvent(index, "mission_b"))),
    ]);
    const linesA = (await (0, promises_1.readFile)(journalPathA, "utf8"))
        .split("\n")
        .filter((line) => line.length > 0);
    const linesB = (await (0, promises_1.readFile)(journalPathB, "utf8"))
        .split("\n")
        .filter((line) => line.length > 0);
    strict_1.default.equal(linesA.length, 5);
    strict_1.default.equal(linesB.length, 5);
    for (const line of linesA) {
        strict_1.default.equal(JSON.parse(line).missionId, "mission_a");
    }
    for (const line of linesB) {
        strict_1.default.equal(JSON.parse(line).missionId, "mission_b");
    }
});
