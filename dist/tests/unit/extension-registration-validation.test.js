"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
const extension_registration_1 = require("../../packages/contracts/src/extension/extension-registration");
const validate_extension_registration_1 = require("../../packages/capability-registry/src/validation/validate-extension-registration");
function getFixtureDir() {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions");
}
function loadFixture(fileName) {
    return JSON.parse((0, node_fs_1.readFileSync)(node_path_1.default.join(getFixtureDir(), fileName), "utf8"));
}
(0, node_test_1.default)("validateExtensionRegistration accepte un manifest execution_adapter et normalise les listes opaques", () => {
    const fixtureDir = getFixtureDir();
    const result = (0, validate_extension_registration_1.validateExtensionRegistration)(loadFixture("valid-execution-adapter.json"), {
        baseDir: fixtureDir,
    });
    strict_1.default.equal(result.ok, true);
    strict_1.default.equal(result.registration?.schemaVersion, extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION);
    strict_1.default.equal(result.registration?.seamType, "execution_adapter");
    strict_1.default.equal(result.registration?.id, "ext.adapter.codex.responses.local");
    strict_1.default.deepEqual(result.registration?.permissions, ["cli.run", "fs.read"]);
    strict_1.default.deepEqual(result.registration?.constraints, ["local_only", "workspace_scoped"]);
    strict_1.default.deepEqual(result.registration?.executionAdapter.requiredEnvNames, ["OPENAI_API_KEY", "CORP_CODEX_RESPONSES_MODEL"]);
    strict_1.default.equal(result.resolvedLocalRefs?.entrypoint, node_path_1.default.join(fixtureDir, "adapters", "codex-responses", "index.js"));
    strict_1.default.deepEqual(result.diagnostics, []);
});
(0, node_test_1.default)("validateExtensionRegistration accepte une capability MCP-backed sans config vendor inline", () => {
    const fixtureDir = getFixtureDir();
    const result = (0, validate_extension_registration_1.validateExtensionRegistration)(loadFixture("valid-capability-mcp.json"), {
        baseDir: fixtureDir,
    });
    strict_1.default.equal(result.ok, true);
    strict_1.default.equal(result.registration?.seamType, "capability");
    strict_1.default.equal(result.registration?.capability.provider, "mcp");
    strict_1.default.equal(result.registration?.capability.mcpServerName, "corp-mcp");
    strict_1.default.equal(result.registration?.capability.mcpToolName, "search_local_docs");
    strict_1.default.equal(result.resolvedLocalRefs?.entrypoint, undefined);
    strict_1.default.doesNotMatch(JSON.stringify(result.registration), /responseId|threadId|pollCursor|vendorStatus|apiKey|token|secretValue/i);
});
(0, node_test_1.default)("validateExtensionRegistration rejette explicitement les champs hors scope V1", () => {
    const result = (0, validate_extension_registration_1.validateExtensionRegistration)(loadFixture("invalid-marketplace.json"), {
        baseDir: getFixtureDir(),
    });
    strict_1.default.equal(result.ok, false);
    strict_1.default.match(result.diagnostics.map((diagnostic) => diagnostic.code).join(","), /out_of_scope_field/);
    strict_1.default.ok(result.diagnostics.some((diagnostic) => diagnostic.path === "marketplace"));
});
(0, node_test_1.default)("validateExtensionRegistration rejette les refs distantes dans localRefs", () => {
    const result = (0, validate_extension_registration_1.validateExtensionRegistration)(loadFixture("invalid-remote-ref.json"), {
        baseDir: getFixtureDir(),
    });
    strict_1.default.equal(result.ok, false);
    strict_1.default.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "non_local_ref"
        && diagnostic.path === "localRefs.references[0]"));
});
(0, node_test_1.default)("validateExtensionRegistration exige un outil MCP quand provider=mcp", () => {
    const fixtureDir = getFixtureDir();
    const result = (0, validate_extension_registration_1.validateExtensionRegistration)({
        schemaVersion: "corp.extension.v1",
        seamType: "capability",
        id: "ext.capability.mcp.incomplete",
        displayName: "Capability MCP incomplete",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only"],
        metadata: {
            description: "Fixture incomplete pour tester les diagnostics.",
            owner: "core-platform",
            tags: ["mcp"],
        },
        localRefs: {
            rootDir: ".",
            references: ["./docs/capability-mcp.md"],
            scripts: [],
        },
        capability: {
            capabilityId: "docs.search",
            provider: "mcp",
            approvalSensitive: false,
            requiredEnvNames: [],
            mcpServerName: "corp-mcp",
        },
    }, {
        baseDir: fixtureDir,
    });
    strict_1.default.equal(result.ok, false);
    strict_1.default.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "missing_required_field"
        && diagnostic.path === "capability.mcpToolName"));
});
(0, node_test_1.default)("validateExtensionRegistration rejette les details vendor et secrets inline", () => {
    const fixtureDir = getFixtureDir();
    const result = (0, validate_extension_registration_1.validateExtensionRegistration)({
        schemaVersion: "corp.extension.v1",
        seamType: "execution_adapter",
        id: "ext.adapter.invalid.vendor-leak",
        displayName: "Adapter invalide",
        version: "0.1.0",
        permissions: ["cli.run"],
        constraints: ["local_only"],
        metadata: {
            description: "Fixture invalide pour detecter les fuites vendor.",
            owner: "core-platform",
            tags: ["adapter"],
        },
        localRefs: {
            rootDir: ".",
            entrypoint: "./adapters/codex-responses/index.js",
            references: [],
            scripts: [],
        },
        executionAdapter: {
            adapterRuntimeId: "codex_responses",
            launchMode: "foreground_or_background",
            supportsBackground: true,
            requiredEnvNames: ["OPENAI_API_KEY"],
            responseId: "resp_123",
            apiKey: "clear-text-secret",
        },
    }, {
        baseDir: fixtureDir,
    });
    strict_1.default.equal(result.ok, false);
    strict_1.default.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "forbidden_field"
        && diagnostic.path === "executionAdapter.responseId"));
    strict_1.default.ok(result.diagnostics.some((diagnostic) => diagnostic.code === "forbidden_field"
        && diagnostic.path === "executionAdapter.apiKey"));
});
