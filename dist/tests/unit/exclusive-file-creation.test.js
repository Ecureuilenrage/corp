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
const file_event_log_1 = require("../../packages/journal/src/event-log/file-event-log");
const file_projection_store_1 = require("../../packages/storage/src/projection-store/file-projection-store");
(0, node_test_1.default)("ensureAppendOnlyEventLog ne signale qu'une creation sous appels concurrents", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-event-log-exclusive-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const journalPath = node_path_1.default.join(rootDir, "events.jsonl");
    const results = await Promise.all(Array.from({ length: 20 }, () => (0, file_event_log_1.ensureAppendOnlyEventLog)(journalPath)));
    strict_1.default.equal(results.filter(Boolean).length, 1);
});
(0, node_test_1.default)("seedProjectionStore traite EEXIST comme benign sous appels concurrents", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-projection-seed-exclusive-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const results = await Promise.all(Array.from({ length: 20 }, () => (0, file_projection_store_1.seedProjectionStore)(rootDir, {
        "resume-view": { schemaVersion: 1, resume: null },
    })));
    const createdCount = results
        .flatMap((result) => result.createdPaths)
        .filter((createdPath) => createdPath.endsWith("resume-view.json"))
        .length;
    strict_1.default.equal(createdCount, 1);
});
