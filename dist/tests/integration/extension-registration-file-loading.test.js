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
const read_extension_registration_file_1 = require("../../packages/capability-registry/src/validation/read-extension-registration-file");
function getFixturePath(fileName) {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", fileName);
}
(0, node_test_1.default)("readExtensionRegistrationFile resolve les refs locales relativement au fichier de declaration", async () => {
    const result = await (0, read_extension_registration_file_1.readExtensionRegistrationFile)(getFixturePath("valid-capability-local.json"));
    strict_1.default.equal(result.ok, true);
    strict_1.default.equal(result.filePath, getFixturePath("valid-capability-local.json"));
    strict_1.default.equal(result.resolvedLocalRefs?.entrypoint, node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", "capabilities", "shell-exec.ts"));
    strict_1.default.deepEqual(result.resolvedLocalRefs?.references, [
        node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions", "docs", "capability-local.md"),
    ]);
});
(0, node_test_1.default)("readExtensionRegistrationFile remonte un diagnostic structure quand une ref locale manque", async () => {
    const result = await (0, read_extension_registration_file_1.readExtensionRegistrationFile)(getFixturePath("invalid-missing-local-ref.json"));
    strict_1.default.equal(result.ok, false);
    strict_1.default.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "missing_local_ref"
        && diagnostic.path === "localRefs.entrypoint"));
});
(0, node_test_1.default)("readExtensionRegistrationFile remonte un diagnostic stable quand le JSON est invalide", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-extension-json-"));
    const invalidFilePath = node_path_1.default.join(tempDir, "invalid.json");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.writeFile)(invalidFilePath, "{invalid", "utf8");
    const result = await (0, read_extension_registration_file_1.readExtensionRegistrationFile)(invalidFilePath);
    strict_1.default.equal(result.ok, false);
    strict_1.default.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "invalid_json"
        && diagnostic.path === "$"));
});
