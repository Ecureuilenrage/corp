import assert from "node:assert/strict";
import test from "node:test";

import {
  buildRequestBody,
  createCodexResponsesAdapter,
  mapResponseStatus,
  normalizeResponseOutputs,
} from "../../packages/execution-adapters/codex-responses/src/codex-responses-adapter";
import type { Mission } from "../../packages/contracts/src/mission/mission";
import type { Ticket } from "../../packages/contracts/src/ticket/ticket";

const mission: Mission = {
  id: "mission_demo",
  title: "Mission demo",
  objective: "Executer un ticket borne",
  status: "ready",
  successCriteria: ["La mission reste traquable"],
  policyProfileId: "policy_profile_local",
  authorizedExtensions: {
    allowedCapabilities: [],
    skillPackRefs: [],
  },
  ticketIds: ["ticket_demo"],
  artifactIds: [],
  eventIds: ["event_demo"],
  resumeCursor: "event_demo",
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
};

const ticket: Ticket = {
  id: "ticket_demo",
  missionId: "mission_demo",
  kind: "implement",
  goal: "Livrer la fonctionnalite",
  status: "todo",
  owner: "agent_demo",
  dependsOn: [],
  successCriteria: ["Le ticket est execute", "Le resultat est trace"],
  allowedCapabilities: [],
  skillPackRefs: [],
  workspaceIsolationId: null,
  executionHandle: {
    adapter: "codex_responses",
    adapterState: {},
  },
  artifactIds: [],
  eventIds: ["event_demo"],
  createdAt: "2026-04-10T10:00:00.000Z",
  updatedAt: "2026-04-10T10:00:00.000Z",
};

test("mapResponseStatus couvre tous les statuts vendor attendus", () => {
  const cases = [
    { status: "completed", expected: "completed" },
    { status: "failed", expected: "failed" },
    { status: "cancelled", expected: "cancelled" },
    { status: "in_progress", expected: "running" },
    { status: "queued", expected: "requested" },
    { status: "requires_action", expected: "awaiting_approval" },
    { status: undefined, expected: "failed" },
  ] as const;

  for (const testCase of cases) {
    assert.equal(mapResponseStatus(testCase.status), testCase.expected);
  }
});

test("normalizeResponseOutputs ignore un output_text vide", () => {
  assert.deepEqual(normalizeResponseOutputs({
    output_text: "   ",
  }), []);
});

test("normalizeResponseOutputs rend le texte top-level et les sorties structurees", () => {
  assert.deepEqual(normalizeResponseOutputs({
    output_text: "  Synthese utile  ",
    output: [
      {
        content: [
          {
            text: "Texte supplementaire",
          },
          {
            json: {
              ok: true,
              score: 1,
            },
          },
        ],
      },
      {
        result: {
          nested: "value",
        },
      },
    ],
  }), [
    {
      kind: "text",
      title: "Synthese adapteur",
      text: "Synthese utile",
      mediaType: "text/plain",
    },
    {
      kind: "text",
      title: "Texte de reponse 1",
      text: "Texte supplementaire",
      mediaType: "text/plain",
    },
    {
      kind: "structured",
      title: "Sortie structuree 1",
      data: {
        ok: true,
        score: 1,
      },
      mediaType: "application/json",
    },
    {
      kind: "structured",
      title: "Sortie structuree 2",
      data: {
        nested: "value",
      },
      mediaType: "application/json",
    },
  ]);
});

test("buildRequestBody rend un payload minimal foreground", () => {
  assert.deepEqual(buildRequestBody({
    mission,
    ticket,
    attemptId: "attempt_demo",
    workspacePath: "C:/isolations/iso_demo",
    background: false,
    resolvedSkillPacks: [],
  }, "gpt-5-codex"), {
    model: "gpt-5-codex",
    background: false,
    store: false,
    input: [
      {
        role: "system",
        content: [
          {
            type: "input_text",
            text: "Vous executez un ticket corp dans un workspace isole. Restez borne au ticket et a la mission.",
          },
        ],
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: [
              "Mission: Mission demo",
              "Objectif mission: Executer un ticket borne",
              "Policy profile: policy_profile_local",
              "Ticket: Livrer la fonctionnalite",
              "Owner: agent_demo",
              "Allowed capabilities: aucune",
              "Skill packs: aucun",
              "Workspace isole: C:/isolations/iso_demo",
              "Criteres de succes: Le ticket est execute | Le resultat est trace",
            ].join("\n"),
          },
        ],
      },
    ],
    metadata: {
      mission_id: "mission_demo",
      ticket_id: "ticket_demo",
      attempt_id: "attempt_demo",
    },
  });
});

test("buildRequestBody injecte les capabilities et skill packs dans le brief d'execution", () => {
  const payload = buildRequestBody({
    mission,
    ticket: {
      ...ticket,
      allowedCapabilities: ["fs.read", "cli.run"],
      skillPackRefs: ["pack.audit"],
    },
    attemptId: "attempt_guardrails",
    workspacePath: "C:/isolations/iso_guardrails",
    background: false,
    resolvedSkillPacks: [
      {
        packRef: "pack.audit",
        displayName: "Pack audit local",
        description: "Resume declaratif du pack d'audit",
        owner: "core-platform",
        tags: ["skill-pack", "local"],
        rootDir: "C:/packs/audit",
        references: ["C:/packs/audit/README.md"],
        metadataFile: "C:/packs/audit/pack.json",
        scripts: ["C:/packs/audit/scripts/preflight.sh"],
      },
    ],
  }, "gpt-5-codex");
  const userContent = (
    payload.input as Array<{
      role: string;
      content: Array<{ text: string }>;
    }>
  )[1]?.content[0]?.text;

  assert.match(userContent, /Policy profile: policy_profile_local/);
  assert.match(userContent, /Allowed capabilities: fs\.read, cli\.run/);
  assert.match(userContent, /Skill packs: pack\.audit/);
  assert.match(userContent, /Skill pack summaries:/);
  assert.match(userContent, /pack\.audit \| Pack audit local \| Resume declaratif du pack d'audit/);
  assert.match(userContent, /refs: C:\/packs\/audit\/README\.md/);
  assert.match(userContent, /metadata: C:\/packs\/audit\/pack\.json/);
  assert.match(userContent, /scripts: C:\/packs\/audit\/scripts\/preflight\.sh/);
  assert.doesNotMatch(userContent, /Pack de triage local\.|echo "preflight"/);
});

test("buildRequestBody active store pour le mode background", () => {
  const payload = buildRequestBody({
    mission,
    ticket,
    attemptId: "attempt_background",
    workspacePath: "C:/isolations/iso_background",
    background: true,
    resolvedSkillPacks: [],
  }, "gpt-5.4");

  assert.equal(payload.background, true);
  assert.equal(payload.store, true);
  assert.deepEqual(payload.metadata, {
    mission_id: "mission_demo",
    ticket_id: "ticket_demo",
    attempt_id: "attempt_background",
  });
});

test("launch retourne awaiting_approval avec approvalRequest quand le vendor renvoie requires_action", async () => {
  const adapter = createCodexResponsesAdapter({
    apiKey: "test-key",
    model: "gpt-5-codex",
    endpoint: "https://test.local/v1",
    fetchImpl: async () => new Response(JSON.stringify({
      id: "resp_approval_vendor",
      status: "requires_action",
      sequence_number: 42,
      output: [
        {
          type: "approval_request",
          title: "Ecriture sensible detectee",
          action_type: "workspace_write",
          summary: "Le modele souhaite modifier un fichier protege.",
          guardrails: ["sandbox: restricted", "manual_review: required"],
        },
      ],
    }), { status: 200 }),
  });

  const result = await adapter.launch({
    mission,
    ticket,
    attemptId: "attempt_approval",
    workspacePath: "C:/isolations/iso_approval",
    background: true,
    resolvedSkillPacks: [],
  });

  assert.equal(result.status, "awaiting_approval");
  assert.equal(result.adapterState.responseId, "resp_approval_vendor");
  assert.equal(result.adapterState.sequenceNumber, 42);
  assert.equal(result.adapterState.vendorStatus, "requires_action");
  assert.equal(result.adapterState.pollCursor, "resp_approval_vendor");
  assert.ok(result.approvalRequest);
  assert.equal(result.approvalRequest.title, "Ecriture sensible detectee");
  assert.equal(result.approvalRequest.actionType, "workspace_write");
  assert.equal(result.approvalRequest.actionSummary, "Le modele souhaite modifier un fichier protege.");
  assert.deepEqual(result.approvalRequest.guardrails, ["sandbox: restricted", "manual_review: required"]);
});

test("launch retourne awaiting_approval avec fallbacks quand le vendor omet les details d'approbation", async () => {
  const adapter = createCodexResponsesAdapter({
    apiKey: "test-key",
    model: "gpt-5-codex",
    endpoint: "https://test.local/v1",
    fetchImpl: async () => new Response(JSON.stringify({
      id: "resp_approval_bare",
      status: "requires_action",
      output: [],
    }), { status: 200 }),
  });

  const result = await adapter.launch({
    mission,
    ticket,
    attemptId: "attempt_bare",
    workspacePath: "C:/isolations/iso_bare",
    background: false,
    resolvedSkillPacks: [],
  });

  assert.equal(result.status, "awaiting_approval");
  assert.ok(result.approvalRequest);
  assert.equal(result.approvalRequest.title, "Validation requise pour une action sensible");
  assert.equal(result.approvalRequest.actionType, "sensitive_action");
  assert.ok(result.approvalRequest.actionSummary.length > 0);
  assert.equal(result.approvalRequest.guardrails, undefined);
  assert.doesNotMatch(JSON.stringify(result.approvalRequest), /requires_action/);
});
