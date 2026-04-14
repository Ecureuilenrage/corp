import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  EXTENSION_REGISTRATION_SCHEMA_VERSION,
} from "../../packages/contracts/src/extension/extension-registration";
import {
  validateExtensionRegistration,
} from "../../packages/capability-registry/src/validation/validate-extension-registration";

function getFixtureDir(): string {
  return path.join(process.cwd(), "tests", "fixtures", "extensions");
}

function loadFixture(fileName: string): unknown {
  return JSON.parse(
    readFileSync(path.join(getFixtureDir(), fileName), "utf8"),
  ) as unknown;
}

test("validateExtensionRegistration accepte un manifest execution_adapter et normalise les listes opaques", () => {
  const fixtureDir = getFixtureDir();
  const result = validateExtensionRegistration(
    loadFixture("valid-execution-adapter.json"),
    {
      baseDir: fixtureDir,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.registration?.schemaVersion, EXTENSION_REGISTRATION_SCHEMA_VERSION);
  assert.equal(result.registration?.seamType, "execution_adapter");
  assert.equal(result.registration?.id, "ext.adapter.codex.responses.local");
  assert.deepEqual(result.registration?.permissions, ["cli.run", "fs.read"]);
  assert.deepEqual(
    result.registration?.constraints,
    ["local_only", "workspace_scoped"],
  );
  assert.deepEqual(
    result.registration?.executionAdapter.requiredEnvNames,
    ["OPENAI_API_KEY", "CORP_CODEX_RESPONSES_MODEL"],
  );
  assert.equal(
    result.resolvedLocalRefs?.entrypoint,
    path.join(fixtureDir, "adapters", "codex-responses", "index.js"),
  );
  assert.deepEqual(result.diagnostics, []);
});

test("validateExtensionRegistration accepte une capability MCP-backed sans config vendor inline", () => {
  const fixtureDir = getFixtureDir();
  const result = validateExtensionRegistration(
    loadFixture("valid-capability-mcp.json"),
    {
      baseDir: fixtureDir,
    },
  );

  assert.equal(result.ok, true);
  assert.equal(result.registration?.seamType, "capability");
  assert.equal(result.registration?.capability.provider, "mcp");
  assert.equal(result.registration?.capability.mcpServerName, "corp-mcp");
  assert.equal(result.registration?.capability.mcpToolName, "search_local_docs");
  assert.equal(result.resolvedLocalRefs?.entrypoint, undefined);
  assert.doesNotMatch(
    JSON.stringify(result.registration),
    /responseId|threadId|pollCursor|vendorStatus|apiKey|token|secretValue/i,
  );
});

test("validateExtensionRegistration rejette explicitement les champs hors scope V1", () => {
  const result = validateExtensionRegistration(
    loadFixture("invalid-marketplace.json"),
    {
      baseDir: getFixtureDir(),
    },
  );

  assert.equal(result.ok, false);
  assert.match(
    result.diagnostics.map((diagnostic) => diagnostic.code).join(","),
    /out_of_scope_field/,
  );
  assert.ok(
    result.diagnostics.some((diagnostic) => diagnostic.path === "marketplace"),
  );
});

test("validateExtensionRegistration rejette les refs distantes dans localRefs", () => {
  const result = validateExtensionRegistration(
    loadFixture("invalid-remote-ref.json"),
    {
      baseDir: getFixtureDir(),
    },
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some((diagnostic) =>
      diagnostic.code === "non_local_ref"
      && diagnostic.path === "localRefs.references[0]"
    ),
  );
});

test("validateExtensionRegistration exige un outil MCP quand provider=mcp", () => {
  const fixtureDir = getFixtureDir();
  const result = validateExtensionRegistration(
    {
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
    },
    {
      baseDir: fixtureDir,
    },
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some((diagnostic) =>
      diagnostic.code === "missing_required_field"
      && diagnostic.path === "capability.mcpToolName"
    ),
  );
});

test("validateExtensionRegistration rejette les details vendor et secrets inline", () => {
  const fixtureDir = getFixtureDir();
  const result = validateExtensionRegistration(
    {
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
    },
    {
      baseDir: fixtureDir,
    },
  );

  assert.equal(result.ok, false);
  assert.ok(
    result.diagnostics.some((diagnostic) =>
      diagnostic.code === "forbidden_field"
      && diagnostic.path === "executionAdapter.responseId"
    ),
  );
  assert.ok(
    result.diagnostics.some((diagnostic) =>
      diagnostic.code === "forbidden_field"
      && diagnostic.path === "executionAdapter.apiKey"
    ),
  );
});
