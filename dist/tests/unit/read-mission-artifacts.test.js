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
const read_mission_artifacts_1 = require("../../packages/mission-kernel/src/resume-service/read-mission-artifacts");
(0, node_test_1.default)("readPayloadPreview lit un payload volumineux de maniere bornee sans casser l'utf8", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-read-payload-preview-"));
    const payloadPath = node_path_1.default.join(rootDir, "payload.txt");
    const requestedLengths = [];
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    await (0, promises_1.writeFile)(payloadPath, `${"€".repeat(5000)}suffix`, "utf8");
    const preview = await (0, read_mission_artifacts_1.readPayloadPreview)(rootDir, "payload.txt", "text/plain", {
        openFile: async (filePath, flags) => {
            const handle = await (0, promises_1.open)(filePath, flags ?? "r");
            return {
                read: async (buffer, offset, length, position) => {
                    requestedLengths.push(length);
                    return handle.read(buffer, offset, length, position);
                },
                close: async () => handle.close(),
            };
        },
    });
    strict_1.default.deepEqual(requestedLengths, [read_mission_artifacts_1.MAX_PREVIEW_BYTES]);
    strict_1.default.ok(preview);
    strict_1.default.ok(preview.length <= 240);
    strict_1.default.doesNotMatch(preview, /�/);
    strict_1.default.match(preview, /^€+/);
});
