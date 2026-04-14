"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const codex_responses_adapter_1 = require("../../packages/execution-adapters/codex-responses/src/codex-responses-adapter");
const mission = {
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
const ticket = {
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
(0, node_test_1.default)("mapResponseStatus couvre tous les statuts vendor attendus", () => {
    const cases = [
        { status: "completed", expected: "completed" },
        { status: "failed", expected: "failed" },
        { status: "cancelled", expected: "cancelled" },
        { status: "in_progress", expected: "running" },
        { status: "queued", expected: "requested" },
        { status: "requires_action", expected: "awaiting_approval" },
        { status: undefined, expected: "failed" },
    ];
    for (const testCase of cases) {
        strict_1.default.equal((0, codex_responses_adapter_1.mapResponseStatus)(testCase.status), testCase.expected);
    }
});
(0, node_test_1.default)("normalizeResponseOutputs ignore un output_text vide", () => {
    strict_1.default.deepEqual((0, codex_responses_adapter_1.normalizeResponseOutputs)({
        output_text: "   ",
    }), []);
});
(0, node_test_1.default)("normalizeResponseOutputs rend le texte top-level et les sorties structurees", () => {
    strict_1.default.deepEqual((0, codex_responses_adapter_1.normalizeResponseOutputs)({
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
(0, node_test_1.default)("buildRequestBody rend un payload minimal foreground", () => {
    strict_1.default.deepEqual((0, codex_responses_adapter_1.buildRequestBody)({
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
(0, node_test_1.default)("buildRequestBody injecte les capabilities et skill packs dans le brief d'execution", () => {
    const payload = (0, codex_responses_adapter_1.buildRequestBody)({
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
    const userContent = payload.input[1]?.content[0]?.text;
    strict_1.default.match(userContent, /Policy profile: policy_profile_local/);
    strict_1.default.match(userContent, /Allowed capabilities: fs\.read, cli\.run/);
    strict_1.default.match(userContent, /Skill packs: pack\.audit/);
    strict_1.default.match(userContent, /Skill pack summaries:/);
    strict_1.default.match(userContent, /pack\.audit \| Pack audit local \| Resume declaratif du pack d'audit/);
    strict_1.default.match(userContent, /refs: C:\/packs\/audit\/README\.md/);
    strict_1.default.match(userContent, /metadata: C:\/packs\/audit\/pack\.json/);
    strict_1.default.match(userContent, /scripts: C:\/packs\/audit\/scripts\/preflight\.sh/);
    strict_1.default.doesNotMatch(userContent, /Pack de triage local\.|echo "preflight"/);
});
(0, node_test_1.default)("buildRequestBody active store pour le mode background", () => {
    const payload = (0, codex_responses_adapter_1.buildRequestBody)({
        mission,
        ticket,
        attemptId: "attempt_background",
        workspacePath: "C:/isolations/iso_background",
        background: true,
        resolvedSkillPacks: [],
    }, "gpt-5.4");
    strict_1.default.equal(payload.background, true);
    strict_1.default.equal(payload.store, true);
    strict_1.default.deepEqual(payload.metadata, {
        mission_id: "mission_demo",
        ticket_id: "ticket_demo",
        attempt_id: "attempt_background",
    });
});
(0, node_test_1.default)("launch retourne awaiting_approval avec approvalRequest quand le vendor renvoie requires_action", async () => {
    const adapter = (0, codex_responses_adapter_1.createCodexResponsesAdapter)({
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
    strict_1.default.equal(result.status, "awaiting_approval");
    strict_1.default.equal(result.adapterState.responseId, "resp_approval_vendor");
    strict_1.default.equal(result.adapterState.sequenceNumber, 42);
    strict_1.default.equal(result.adapterState.vendorStatus, "requires_action");
    strict_1.default.equal(result.adapterState.pollCursor, "resp_approval_vendor");
    strict_1.default.ok(result.approvalRequest);
    strict_1.default.equal(result.approvalRequest.title, "Ecriture sensible detectee");
    strict_1.default.equal(result.approvalRequest.actionType, "workspace_write");
    strict_1.default.equal(result.approvalRequest.actionSummary, "Le modele souhaite modifier un fichier protege.");
    strict_1.default.deepEqual(result.approvalRequest.guardrails, ["sandbox: restricted", "manual_review: required"]);
});
(0, node_test_1.default)("launch retourne awaiting_approval avec fallbacks quand le vendor omet les details d'approbation", async () => {
    const adapter = (0, codex_responses_adapter_1.createCodexResponsesAdapter)({
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
    strict_1.default.equal(result.status, "awaiting_approval");
    strict_1.default.ok(result.approvalRequest);
    strict_1.default.equal(result.approvalRequest.title, "Validation requise pour une action sensible");
    strict_1.default.equal(result.approvalRequest.actionType, "sensitive_action");
    strict_1.default.ok(result.approvalRequest.actionSummary.length > 0);
    strict_1.default.equal(result.approvalRequest.guardrails, undefined);
    strict_1.default.doesNotMatch(JSON.stringify(result.approvalRequest), /requires_action/);
});
