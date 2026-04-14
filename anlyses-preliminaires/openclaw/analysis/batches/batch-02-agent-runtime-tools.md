# Batch 02 - Agent Runtime and Tools

Scope: `1769` files. Main concentration: [`src/agents/`](../../src/agents), [`src/auto-reply/`](../../src/auto-reply), [`src/hooks/`](../../src/hooks), [`src/tasks/`](../../src/tasks).

## purpose

This batch owns the in-process agent runtime: command preparation, embedded run attempts, model/auth selection, fallback behavior, tool inventory assembly, subagent lifecycle, and the auto-reply bridge that reuses the same core instead of forking a second runtime.

For extraction work, the important split is between the huge attempt-time execution core and the smaller policy kernels around model selection, auth-profile ordering, tool composition, and subagent control. The most dangerous files are [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts) and [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts), because they sit at the convergence point of sessions, config, hooks, plugins, tool schemas, streaming transports, compaction, and delivery side effects.

Hooks and tasks are in scope for this batch mostly as consumers of the runtime. They matter for reuse because they show where the runtime contracts leak outward, but they are usually not the first files to extract.

## entrypoints

- [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts): central command-level agent execution hub for trusted local callers and explicit ingress callers.
- [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts): embedded runner entry that schedules lanes, resolves workspace/auth/model state, and loops over attempts.
- [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts): assembles the shipped tool inventory for an agent turn.
- [`src/agents/subagent-spawn.ts`](../../src/agents/subagent-spawn.ts): direct subagent creation seam used by tools and runtime flows.
- [`src/auto-reply/reply.runtime.ts`](../../src/auto-reply/reply.runtime.ts): public runtime surface for reply generation.
- [`src/auto-reply/reply/agent-runner.ts`](../../src/auto-reply/reply/agent-runner.ts): auto-reply handoff into the agent runtime.

## key files

- [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts): widest fan-out file in the batch; owns prompt/tool/session-manager assembly inside a single attempt.
- [`src/agents/pi-embedded-runner/compact.ts`](../../src/agents/pi-embedded-runner/compact.ts): compaction runtime, transcript shrinking, and post-compaction side effects.
- [`src/agents/openclaw-plugin-tools.ts`](../../src/agents/openclaw-plugin-tools.ts): late-bound plugin tool injection on top of the shipped core tool set.
- [`src/agents/subagent-registry.ts`](../../src/agents/subagent-registry.ts): persistent in-memory and on-disk lifecycle store for spawned subagents.
- [`src/agents/subagent-control.ts`](../../src/agents/subagent-control.ts): list/kill/steer/send control shell over subagent runs.
- [`src/agents/auth-profiles/store.ts`](../../src/agents/auth-profiles/store.ts): auth-profile persistence, runtime snapshots, and store locking.
- [`src/agents/auth-profiles/usage.ts`](../../src/agents/auth-profiles/usage.ts): cooldown, failure accounting, and profile health logic.
- [`src/agents/model-selection.ts`](../../src/agents/model-selection.ts): model-ref parsing, allowlists, alias catalogs, and subagent-specific selection.
- [`src/agents/model-fallback.ts`](../../src/agents/model-fallback.ts): retry/fallback executor with probe throttling.
- [`src/agents/models-config.ts`](../../src/agents/models-config.ts): managed `models.json` materialization and fingerprint-based rewrite avoidance.
- [`src/auto-reply/reply/agent-runner-execution.ts`](../../src/auto-reply/reply/agent-runner-execution.ts): reply-side wrapper around the same fallback and embedded-runner core.

## data flow

- Trusted local CLI and operator flows enter through [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts), while network-facing callers must use `agentCommandFromIngress`, which forces explicit trust flags instead of inheriting CLI defaults.
- [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts) resolves runtime config, session/workspace context, model overrides, delivery targets, and session-store state through `resolveAgentRuntimeConfig` and `prepareAgentCommandExecution` before delegating to the runtime loop.
- Embedded runs then flow through [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts), which backfills missing session keys, chooses execution lanes, ensures runtime plugins and managed model metadata are ready, resolves auth profile order, and drives retries/failover around `runEmbeddedAttempt`.
- A single attempt in [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts) creates the session manager, composes system prompt state, assembles tool definitions, wires MCP/LSP/tool runtimes, normalizes provider transport behavior, and streams one turn.
- Tool inventory comes from [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts), which builds the shipped core tool set and then optionally appends plugin tools from [`src/agents/openclaw-plugin-tools.ts`](../../src/agents/openclaw-plugin-tools.ts).
- Session and subagent tools eventually route into [`src/agents/subagent-spawn.ts`](../../src/agents/subagent-spawn.ts), [`src/agents/subagent-registry.ts`](../../src/agents/subagent-registry.ts), [`src/agents/subagent-control.ts`](../../src/agents/subagent-control.ts), and gateway methods such as `agent`, `sessions.resolve`, `sessions.patch`, and `sessions.delete`.
- Auto-reply reuses the same agent core through [`src/auto-reply/reply/agent-runner.ts`](../../src/auto-reply/reply/agent-runner.ts) and [`src/auto-reply/reply/agent-runner-execution.ts`](../../src/auto-reply/reply/agent-runner-execution.ts), which call the embedded runner and the same fallback logic instead of maintaining a second model loop.
- Peripheral consumers such as [`src/hooks/llm-slug-generator.ts`](../../src/hooks/llm-slug-generator.ts) and [`src/tasks/task-registry-control.runtime.ts`](../../src/tasks/task-registry-control.runtime.ts) show how the runtime is reused by other subsystems.

## external deps

- `@mariozechner/pi-coding-agent` and `@mariozechner/pi-agent-core` are hard dependencies for the current attempt/session runtime in [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts).
- Provider transports and provider-specific behavior sit behind files such as [`src/agents/openai-transport-stream.ts`](../../src/agents/openai-transport-stream.ts), [`src/agents/google-transport-stream.ts`](../../src/agents/google-transport-stream.ts), and [`src/agents/anthropic-transport-stream.ts`](../../src/agents/anthropic-transport-stream.ts).
- `@sinclair/typebox` shapes tool parameter contracts in the session/subagent tool wrappers.
- Node filesystem and OS primitives are used directly for sessions, compaction, generated `models.json`, temp workspaces, and auth-profile persistence.

## flags/env

- `tools.experimental.planTool` gates `createUpdatePlanTool` in [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts); when unset, OpenAI/OpenAI-Codex providers enable it implicitly.
- [`src/agents/models-config.ts`](../../src/agents/models-config.ts) fingerprints config plus `createConfigRuntimeEnv` output before deciding whether to rewrite `models.json`, so model discovery is partly environment-shaped even when `process.env` is not mutated directly.
- `sessions_spawn` runtime behavior is controlled by tool params such as `runtime`, `mode`, `thread`, `sandbox`, `runTimeoutSeconds`, and `lightContext` in [`src/agents/tools/sessions-spawn-tool.ts`](../../src/agents/tools/sessions-spawn-tool.ts).
- Sandbox inheritance and spawn eligibility depend on resolved runtime status and per-agent config, not a single env flag, through [`src/agents/subagent-spawn.ts`](../../src/agents/subagent-spawn.ts).
- Auth-profile policy and provider credential availability are driven by the auth-profile store plus config/env-derived secrets surfaces in [`src/agents/auth-profiles/store.ts`](../../src/agents/auth-profiles/store.ts), [`src/agents/auth-profiles/oauth.ts`](../../src/agents/auth-profiles/oauth.ts), and [`src/agents/models-config.ts`](../../src/agents/models-config.ts).

## subdomains

### Embedded run coordinator and retry loop

Classification: `runtime central`.

Anchors:

- [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts)
- [`src/agents/pi-embedded-runner/compact.ts`](../../src/agents/pi-embedded-runner/compact.ts)
- [`src/agents/pi-embedded-runner/run/helpers.ts`](../../src/agents/pi-embedded-runner/run/helpers.ts)
- [`src/agents/pi-embedded-runner/run/failover-policy.ts`](../../src/agents/pi-embedded-runner/run/failover-policy.ts)

This is the outer shell around a turn. It resolves workspace/session state, auth profile rotation, retry/failover policy, compaction recovery, and usage accounting before and after each attempt.

### Attempt-time prompt, transport, and tool loop

Classification: `runtime central`.

Anchors:

- [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts)
- [`src/agents/pi-tools.ts`](../../src/agents/pi-tools.ts)
- [`src/agents/pi-bundle-mcp-tools.ts`](../../src/agents/pi-bundle-mcp-tools.ts)
- [`src/agents/pi-tool-definition-adapter.ts`](../../src/agents/pi-tool-definition-adapter.ts)
- [`src/agents/pi-embedded-runner/tool-schema-runtime.ts`](../../src/agents/pi-embedded-runner/tool-schema-runtime.ts)

This is the real runtime heart of the batch. It assembles session managers, prompt context, MCP/LSP/tool runtimes, sandbox state, stream functions, prompt cache state, and tool result guards.

### Tool inventory composition and plugin late-binding

Classification: `runtime central` plus `adapters`.

Anchors:

- [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts)
- [`src/agents/openclaw-plugin-tools.ts`](../../src/agents/openclaw-plugin-tools.ts)
- [`src/agents/tools/sessions-spawn-tool.ts`](../../src/agents/tools/sessions-spawn-tool.ts)
- [`src/agents/tools/sessions-send-tool.ts`](../../src/agents/tools/sessions-send-tool.ts)
- [`src/agents/tools/subagents-tool.ts`](../../src/agents/tools/subagents-tool.ts)

This subdomain turns host capabilities into model-visible tool contracts. The composition shell is smaller than the embedded runner, but still tied to gateway methods, session visibility rules, and plugin tool metadata.

### Subagent spawn, registry, and operator control

Classification: `runtime central` plus `glue`.

Anchors:

- [`src/agents/subagent-spawn.ts`](../../src/agents/subagent-spawn.ts)
- [`src/agents/subagent-registry.ts`](../../src/agents/subagent-registry.ts)
- [`src/agents/subagent-control.ts`](../../src/agents/subagent-control.ts)
- [`src/agents/tools/subagents-tool.ts`](../../src/agents/tools/subagents-tool.ts)
- [`src/agents/tools/sessions-spawn-tool.ts`](../../src/agents/tools/sessions-spawn-tool.ts)
- [`src/agents/tools/sessions-send-tool.ts`](../../src/agents/tools/sessions-send-tool.ts)

This area covers run creation, session-key ownership, persistent registry state, orphan recovery, list/kill/steer flows, and session-to-session messaging. It is one of the more interesting extraction targets, but only if the new host already has its own session and gateway boundary.

### Auth-profile store, policy, and external credential overlays

Classification: `adapters` plus `infra`.

Anchors:

- [`src/agents/auth-profiles.ts`](../../src/agents/auth-profiles.ts)
- [`src/agents/auth-profiles/store.ts`](../../src/agents/auth-profiles/store.ts)
- [`src/agents/auth-profiles/order.ts`](../../src/agents/auth-profiles/order.ts)
- [`src/agents/auth-profiles/usage.ts`](../../src/agents/auth-profiles/usage.ts)
- [`src/agents/auth-profiles/external-auth.ts`](../../src/agents/auth-profiles/external-auth.ts)
- [`src/agents/auth-profiles/external-cli-sync.ts`](../../src/agents/auth-profiles/external-cli-sync.ts)

This subdomain is more modular than the runner core. It persists credential profiles, merges external auth sources, ranks eligibility, and applies cooldown/failure accounting after bad runs.

### Model selection, managed catalog materialization, and fallback

Classification: `runtime central`.

Anchors:

- [`src/agents/model-selection.ts`](../../src/agents/model-selection.ts)
- [`src/agents/model-fallback.ts`](../../src/agents/model-fallback.ts)
- [`src/agents/models-config.ts`](../../src/agents/models-config.ts)
- [`src/agents/model-auth.ts`](../../src/agents/model-auth.ts)

This is the cleanest policy-heavy kernel in the batch. It normalizes model refs, builds alias and allowlist views, ensures generated model catalogs exist, and retries alternative providers/models when a run degrades.

### Command ingress, auto-reply bridge, and downstream consumers

Classification: `glue`.

Anchors:

- [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts)
- [`src/auto-reply/reply.runtime.ts`](../../src/auto-reply/reply.runtime.ts)
- [`src/auto-reply/reply/agent-runner.ts`](../../src/auto-reply/reply/agent-runner.ts)
- [`src/auto-reply/reply/agent-runner-execution.ts`](../../src/auto-reply/reply/agent-runner-execution.ts)
- [`src/hooks/llm-slug-generator.ts`](../../src/hooks/llm-slug-generator.ts)
- [`src/tasks/task-registry-control.runtime.ts`](../../src/tasks/task-registry-control.runtime.ts)

This layer is where the batch integrates with the rest of the product. It is useful for understanding trust boundaries and reuse surfaces, but it is mostly orchestration glue rather than a first extraction target.

## feature inventory

### Embedded run coordinator

- Goal: resolve session/workspace/auth/model state, schedule lanes, perform retry/failover loops, and coordinate compaction around a turn.
- Open first: [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts), [`src/agents/pi-embedded-runner/compact.ts`](../../src/agents/pi-embedded-runner/compact.ts)
- Pivot symbols: `runEmbeddedPiAgent`, `backfillSessionKey`, `compactEmbeddedPiSessionDirect`, `compactEmbeddedPiSession`, `runPostCompactionSideEffects`
- Strictly required modules: session-key resolution, workspace resolution, auth profile order/store, model resolution, failover helpers, compaction helpers, runtime plugin loading
- Dangerous couplings: mutates long-lived session state, depends on active runtime plugins, assumes OpenClaw session files and usage accounting, and expects the attempt layer to understand the same transcript/tool semantics
- Reuse strategy: `reecrire`

### Attempt-time prompt and tool execution kernel

- Goal: build a single agent attempt with system prompt assembly, session manager state, tool schemas, MCP/LSP runtimes, streaming transport, sandbox policy, and tool result guards.
- Open first: [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts), [`src/agents/pi-tools.ts`](../../src/agents/pi-tools.ts)
- Pivot symbols: `runEmbeddedAttempt`, `createOpenClawCodingTools`, `resolveToolLoopDetectionConfig`, `getOrCreateSessionMcpRuntime`, `resolveEmbeddedAgentStreamFn`
- Strictly required modules: PI session manager contracts, system-prompt builders, prompt cache helpers, tool definition adapters, sandbox runtime, provider stream registry, transcript repair, session write locks
- Dangerous couplings: this file assumes the whole OpenClaw turn model, including bootstrap prompts, tool call normalization, prompt-cache rules, provider-specific quirks, session repair, and plugin runtime contributions
- Reuse strategy: `reecrire`

### Tool inventory composition shell

- Goal: assemble core shipped tools, gate optional tools by provider/config/sandbox, and late-bind plugin tools without duplicating host-specific tool metadata.
- Open first: [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts), [`src/agents/openclaw-plugin-tools.ts`](../../src/agents/openclaw-plugin-tools.ts)
- Pivot symbols: `createOpenClawTools`, `resolveOpenClawPluginToolsForOptions`, `createSessionsSpawnTool`, `createSessionsSendTool`, `createSubagentsTool`
- Strictly required modules: gateway caller, workspace/session identity helpers, tool factory modules, runtime web tool metadata, plugin tool resolver
- Dangerous couplings: tool availability is shaped by gateway access, session visibility policy, sandbox mode, plugin runtime tool metadata, and OpenClaw delivery context conventions
- Reuse strategy: `adapter`

### Subagent lifecycle runtime

- Goal: spawn subagents, persist run metadata, recover orphaned runs, and expose operator controls for list/kill/steer/send flows.
- Open first: [`src/agents/subagent-spawn.ts`](../../src/agents/subagent-spawn.ts), [`src/agents/subagent-registry.ts`](../../src/agents/subagent-registry.ts), [`src/agents/subagent-control.ts`](../../src/agents/subagent-control.ts)
- Pivot symbols: `spawnSubagentDirect`, `registerSubagentRun`, `scheduleSubagentOrphanRecovery`, `resolveSubagentController`, `killControlledSubagentRun`, `steerControlledSubagentRun`, `sendControlledSubagentMessage`
- Strictly required modules: session-key helpers, gateway call surface, registry persistence, announce flow helpers, sandbox/runtime status helpers, agent config access
- Dangerous couplings: child-session naming, max-depth/max-children policy, thread binding, gateway patch/delete calls, registry persistence format, and announce lifecycle are all host contracts
- Reuse strategy: `adapter`

### Auth-profile store and cooldown ordering

- Goal: persist credential profiles, rank eligible profiles, merge external credentials, and mark failures/cooldowns based on observed runtime behavior.
- Open first: [`src/agents/auth-profiles/store.ts`](../../src/agents/auth-profiles/store.ts), [`src/agents/auth-profiles/order.ts`](../../src/agents/auth-profiles/order.ts), [`src/agents/auth-profiles/usage.ts`](../../src/agents/auth-profiles/usage.ts)
- Pivot symbols: `ensureAuthProfileStore`, `loadAuthProfileStoreForRuntime`, `resolveAuthProfileEligibility`, `resolveAuthProfileOrder`, `markAuthProfileFailure`, `markAuthProfileUsed`, `markAuthProfileGood`
- Strictly required modules: auth-profile types, persistence paths, usage stats, cooldown policy, external OAuth/api-key adapters, provider policy checks
- Dangerous couplings: store format and persistence paths are OpenClaw-specific, external auth overlay assumes repository conventions, and some policy checks depend on secret-ref and provider-auth rules outside this batch
- Reuse strategy: `adapter`

### Model selection and managed model catalog

- Goal: normalize model refs, build alias and allowlist state, resolve per-agent or per-subagent defaults, and materialize `models.json` when config-derived discovery changes.
- Open first: [`src/agents/model-selection.ts`](../../src/agents/model-selection.ts), [`src/agents/models-config.ts`](../../src/agents/models-config.ts)
- Pivot symbols: `buildModelAliasIndex`, `resolveConfiguredModelRef`, `resolveDefaultModelForAgent`, `resolveSubagentSpawnModelSelection`, `buildAllowedModelSet`, `buildConfiguredModelCatalog`, `ensureOpenClawModelsJson`
- Strictly required modules: config shape, model-catalog helpers, runtime config snapshots, provider normalization helpers, generated `models.json` planner
- Dangerous couplings: model refs, alias behavior, and generated catalog layout are product policy; `ensureOpenClawModelsJson` also writes to the shared agent directory with lock and fingerprint semantics
- Reuse strategy: `adapter`

### Model fallback runner

- Goal: execute a run against one model/provider, then iterate through candidate fallbacks while preserving error summaries and throttling recovery probes.
- Open first: [`src/agents/model-fallback.ts`](../../src/agents/model-fallback.ts)
- Pivot symbols: `FallbackSummaryError`, `isFallbackSummaryError`, `runWithModelFallback`, `runWithImageModelFallback`, `_probeThrottleInternals`
- Strictly required modules: normalized model refs, candidate selection inputs, provider/model status summaries, and the caller-supplied run function
- Dangerous couplings: fallback classification depends on OpenClaw's error taxonomy and provider naming; blind copy without replacing those assumptions produces bad retry behavior
- Reuse strategy: `adapter`

### Agent command ingress and auto-reply bridge

- Goal: expose the runtime safely to CLI, ingress, and auto-reply callers while preserving trust boundaries, session bookkeeping, delivery side effects, and follow-up behavior.
- Open first: [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts), [`src/auto-reply/reply/agent-runner.ts`](../../src/auto-reply/reply/agent-runner.ts), [`src/auto-reply/reply/agent-runner-execution.ts`](../../src/auto-reply/reply/agent-runner-execution.ts)
- Pivot symbols: `agentCommand`, `agentCommandFromIngress`, `resolveAgentRuntimeConfig`, `prepareAgentCommandExecution`, `runReplyAgent`, `runAgentTurnWithFallback`
- Strictly required modules: runtime config loading, session store mutation, delivery routing, fallback runner, embedded runner, typing/reply queue helpers
- Dangerous couplings: mixes trust policy, session store writes, response delivery, follow-up scheduling, and live model switching; this is integration glue, not a standalone framework layer
- Reuse strategy: `reecrire`

### Peripheral runtime consumers

- Goal: reuse the agent runtime from other product areas without copying the whole orchestration layer.
- Open first: [`src/hooks/llm-slug-generator.ts`](../../src/hooks/llm-slug-generator.ts), [`src/tasks/task-registry-control.runtime.ts`](../../src/tasks/task-registry-control.runtime.ts), [`src/tasks/task-executor-policy.ts`](../../src/tasks/task-executor-policy.ts)
- Pivot symbols: `generateSlugViaLLM`, `killSubagentRunAdmin`, `shouldAutoDeliverTaskTerminalUpdate`
- Strictly required modules: the embedded runner for the slug generator, and the subagent-control/task-status contract for task glue
- Dangerous couplings: these files look small because they rely on the larger batch contracts already being present
- Reuse strategy: `copier` for `generateSlugViaLLM` with adaptation, `adapter` for task-control glue

## symbol map

### Embedded runner core

- [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts): `runEmbeddedPiAgent`, `backfillSessionKey`
- [`src/agents/pi-embedded-runner/compact.ts`](../../src/agents/pi-embedded-runner/compact.ts): `compactEmbeddedPiSessionDirect`, `compactEmbeddedPiSession`, `runPostCompactionSideEffects`
- [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts): `runEmbeddedAttempt`, `appendAttemptCacheTtlIfNeeded`, `composeSystemPromptWithHookContext`, `resolveAttemptSpawnWorkspaceDir`, `buildAfterTurnRuntimeContext`, `prependSystemPromptAddition`, `resolveAttemptFsWorkspaceOnly`, `resolveAttemptPrependSystemContext`, `resolvePromptBuildHookResult`, `resolvePromptModeForSession`, `shouldWarnOnOrphanedUserRepair`, `shouldInjectHeartbeatPrompt`
- [`src/agents/pi-tools.ts`](../../src/agents/pi-tools.ts): `resolveToolLoopDetectionConfig`, `createOpenClawCodingTools`

### Tool inventory and session-facing tools

- [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts): `createOpenClawTools`, `__testing`
- [`src/agents/openclaw-plugin-tools.ts`](../../src/agents/openclaw-plugin-tools.ts): `resolveOpenClawPluginToolsForOptions`
- [`src/agents/tools/sessions-spawn-tool.ts`](../../src/agents/tools/sessions-spawn-tool.ts): `createSessionsSpawnTool`
- [`src/agents/tools/sessions-send-tool.ts`](../../src/agents/tools/sessions-send-tool.ts): `createSessionsSendTool`
- [`src/agents/tools/subagents-tool.ts`](../../src/agents/tools/subagents-tool.ts): `createSubagentsTool`

### Subagent lifecycle and control

- [`src/agents/subagent-spawn.ts`](../../src/agents/subagent-spawn.ts): `SUBAGENT_SPAWN_MODES`, `SUBAGENT_SPAWN_SANDBOX_MODES`, `SpawnSubagentParams`, `SpawnSubagentContext`, `SUBAGENT_SPAWN_ACCEPTED_NOTE`, `SUBAGENT_SPAWN_SESSION_ACCEPTED_NOTE`, `SpawnSubagentResult`, `spawnSubagentDirect`
- [`src/agents/subagent-registry.ts`](../../src/agents/subagent-registry.ts): `scheduleSubagentOrphanRecovery`, `markSubagentRunForSteerRestart`, `clearSubagentRunSteerRestart`, `replaceSubagentRunAfterSteer`, `registerSubagentRun`, `releaseSubagentRun`, `resolveRequesterForChildSession`, `isSubagentSessionRunActive`, `shouldIgnorePostCompletionAnnounceForSession`, `markSubagentRunTerminated`, `listSubagentRunsForRequester`, `listSubagentRunsForController`, `countActiveRunsForSession`, `countActiveDescendantRuns`, `countPendingDescendantRuns`, `countPendingDescendantRunsExcludingRun`, `listDescendantRunsForRequester`, `getSubagentRunByChildSessionKey`, `getLatestSubagentRunByChildSessionKey`, `initSubagentRegistry`
- [`src/agents/subagent-control.ts`](../../src/agents/subagent-control.ts): `resolveSubagentController`, `listControlledSubagentRuns`, `killAllControlledSubagentRuns`, `killControlledSubagentRun`, `killSubagentRunAdmin`, `steerControlledSubagentRun`, `sendControlledSubagentMessage`, `resolveControlledSubagentTarget`

### Auth and model policy

- [`src/agents/auth-profiles.ts`](../../src/agents/auth-profiles.ts): `resolveAuthProfileEligibility`, `resolveAuthProfileOrder`, `ensureAuthProfileStore`, `loadAuthProfileStoreForRuntime`, `loadAuthProfileStoreForSecretsRuntime`, `replaceRuntimeAuthProfileStoreSnapshots`, `dedupeProfileIds`, `listProfilesForProvider`, `markAuthProfileGood`, `markAuthProfileFailure`, `markAuthProfileUsed`, `markAuthProfileCooldown`
- [`src/agents/auth-profiles/store.ts`](../../src/agents/auth-profiles/store.ts): `replaceRuntimeAuthProfileStoreSnapshots`, `clearRuntimeAuthProfileStoreSnapshots`, `loadAuthProfileStore`, `loadAuthProfileStoreForRuntime`, `loadAuthProfileStoreForSecretsRuntime`, `ensureAuthProfileStore`, `saveAuthProfileStore`
- [`src/agents/auth-profiles/order.ts`](../../src/agents/auth-profiles/order.ts): `AuthProfileEligibility`, `resolveAuthProfileEligibility`, `resolveAuthProfileOrder`
- [`src/agents/auth-profiles/usage.ts`](../../src/agents/auth-profiles/usage.ts): `resolveProfilesUnavailableReason`, `getSoonestCooldownExpiry`, `clearExpiredCooldowns`, `markAuthProfileUsed`, `calculateAuthProfileCooldownMs`, `resolveProfileUnusableUntilForDisplay`, `markAuthProfileFailure`, `markAuthProfileCooldown`, `clearAuthProfileCooldown`
- [`src/agents/auth-profiles/external-auth.ts`](../../src/agents/auth-profiles/external-auth.ts): `overlayExternalAuthProfiles`, `shouldPersistExternalAuthProfile`
- [`src/agents/auth-profiles/external-cli-sync.ts`](../../src/agents/auth-profiles/external-cli-sync.ts): `readManagedExternalCliCredential`, `syncExternalCliCredentials`
- [`src/agents/model-selection.ts`](../../src/agents/model-selection.ts): `ThinkLevel`, `ModelAliasIndex`, `isCliProvider`, `resolvePersistedOverrideModelRef`, `resolvePersistedModelRef`, `resolvePersistedSelectedModelRef`, `inferUniqueProviderFromConfiguredModels`, `resolveAllowlistModelKey`, `buildConfiguredAllowlistKeys`, `buildModelAliasIndex`, `resolveModelRefFromString`, `resolveConfiguredModelRef`, `resolveDefaultModelForAgent`, `resolveSubagentConfiguredModelSelection`, `resolveSubagentSpawnModelSelection`, `buildAllowedModelSet`, `buildConfiguredModelCatalog`, `getModelRefStatus`, `resolveAllowedModelRef`, `resolveThinkingDefault`, `resolveReasoningDefault`, `resolveHooksGmailModel`, `normalizeModelSelection`
- [`src/agents/model-fallback.ts`](../../src/agents/model-fallback.ts): `FallbackSummaryError`, `isFallbackSummaryError`, `ModelFallbackRunOptions`, `_probeThrottleInternals`, `runWithModelFallback`, `runWithImageModelFallback`
- [`src/agents/models-config.ts`](../../src/agents/models-config.ts): `ensureOpenClawModelsJson`

### Command and reply bridge

- [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts): `agentCommand`, `agentCommandFromIngress`, `__testing`
- [`src/auto-reply/reply/agent-runner.ts`](../../src/auto-reply/reply/agent-runner.ts): `runReplyAgent`
- [`src/auto-reply/reply/agent-runner-execution.ts`](../../src/auto-reply/reply/agent-runner-execution.ts): `MAX_LIVE_SWITCH_RETRIES`, `applyFallbackCandidateSelectionToEntry`, `runAgentTurnWithFallback`
- [`src/auto-reply/reply.runtime.ts`](../../src/auto-reply/reply.runtime.ts): `getReplyFromConfig`
- [`src/hooks/llm-slug-generator.ts`](../../src/hooks/llm-slug-generator.ts): `generateSlugViaLLM`

## dependency map

### Internal dependencies you must carry together

- The embedded runner outer loop depends on model selection, auth-profile store/order, workspace/session resolution, compaction, runtime plugin loading, and attempt-time helpers. Carrying only [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts) is not viable.
- The attempt kernel depends on PI session manager/runtime contracts, system-prompt builders, prompt cache and transcript repair helpers, tool schema normalization, sandbox runtime, MCP/LSP runtimes, provider stream resolution, and session write locks.
- Tool inventory composition depends on tool factory modules, delivery context normalization, session/workspace resolution, and plugin tool resolution. Session-facing tools also depend on gateway methods and session visibility helpers.
- Subagent lifecycle code depends on session-key parsing, registry persistence, announce hooks, gateway session patch/delete RPC, and per-agent sandbox/runtime policy.
- Auth-profile ordering is smaller than the rest of the batch, but real reuse still needs the profile store shape, usage stats, and provider-specific auth resolution.
- Model selection depends on config structure plus model-catalog inputs; `ensureOpenClawModelsJson` additionally depends on runtime config snapshots and write-lock state.
- Auto-reply glue depends on the embedded runner plus reply queueing, typing, session bookkeeping, and delivery helpers from [`src/auto-reply/reply/`](../../src/auto-reply/reply).

### External dependencies

- `@mariozechner/pi-coding-agent` and `@mariozechner/pi-agent-core` are effectively hard dependencies for the current attempt/session runtime.
- `@sinclair/typebox` is the schema layer for shipped tools and can be swapped only if you also replace the tool registration contract.
- Provider transports and model runtime compatibility layers are external from this batch's point of view even when implemented in-repo.

### Runtime and singleton assumptions

- [`src/agents/subagent-registry.ts`](../../src/agents/subagent-registry.ts) keeps global in-memory registry state, restore state, orphan-recovery timers, and lifecycle listeners.
- [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts) holds injectable deps for tests and assumes a global gateway caller unless overridden.
- [`src/agents/models-config.ts`](../../src/agents/models-config.ts) maintains process-local write locks and ready-cache state keyed by `models.json` path.
- Auth-profile store snapshots can be replaced globally through [`src/agents/auth-profiles/store.ts`](../../src/agents/auth-profiles/store.ts), which matters if you try to reuse the profile code outside the same runtime lifecycle.
- [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts) assumes a trusted local default for `senderIsOwner` and `allowModelOverride`, while ingress callers must opt in explicitly.

### Glue you can rewrite

- Most files under [`src/auto-reply/reply/`](../../src/auto-reply/reply) are product-specific delivery glue around the shared runtime and should usually be rewritten against the target host's messaging layer.
- The specific shipped tool list in [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts) is application inventory, not a universal framework default.
- Hook and task consumers are useful examples, but they are not foundational runtime primitives.

## extraction recipes

### Recipe A - extract the model-ref selection pack

- Carry: [`src/agents/model-selection.ts`](../../src/agents/model-selection.ts) plus the minimum model-ref type helpers it imports from the adjacent model catalog layer
- Keep together: `buildModelAliasIndex`, `resolveConfiguredModelRef`, `resolveDefaultModelForAgent`, `resolveSubagentSpawnModelSelection`, `buildAllowedModelSet`, `resolveAllowedModelRef`
- Replace with shims: config reader, model catalog source, and any repository-specific default-provider rules
- Best use: a future agent host that needs stable model aliases, allowlists, and per-agent overrides before it needs the full OpenClaw runner
- Strategy: `adapter`

### Recipe B - extract auth-profile ordering and cooldown logic

- Carry: [`src/agents/auth-profiles/order.ts`](../../src/agents/auth-profiles/order.ts), [`src/agents/auth-profiles/usage.ts`](../../src/agents/auth-profiles/usage.ts), [`src/agents/auth-profiles/types.ts`](../../src/agents/auth-profiles/types.ts)
- Keep together: `resolveAuthProfileEligibility`, `resolveAuthProfileOrder`, `markAuthProfileFailure`, `markAuthProfileUsed`, `calculateAuthProfileCooldownMs`, `resolveProfilesUnavailableReason`
- Replace with shims: persistence, provider-specific credential resolution, and any policy checks that depend on secret refs or external auth overlays
- Best use: multi-provider hosts that want profile rotation and health accounting without adopting the whole embedded runner
- Strategy: `adapter`

### Recipe C - extract the model fallback executor

- Carry: [`src/agents/model-fallback.ts`](../../src/agents/model-fallback.ts)
- Keep together: `runWithModelFallback`, `runWithImageModelFallback`, `FallbackSummaryError`
- Replace with shims: your own error classifier and fallback-candidate provider
- Best use: hosts that already have a run function and just need a reusable retry/fallback shell
- Strategy: `adapter`

### Recipe D - extract the subagent control shell

- Carry: [`src/agents/subagent-control.ts`](../../src/agents/subagent-control.ts), [`src/agents/tools/subagents-tool.ts`](../../src/agents/tools/subagents-tool.ts)
- Keep together: `resolveSubagentController`, `listControlledSubagentRuns`, `killControlledSubagentRun`, `steerControlledSubagentRun`, `sendControlledSubagentMessage`, `createSubagentsTool`
- Replace with shims: registry read path, gateway call surface, and session-key/controller resolution
- Best use: hosts that already have child-session tracking and need an operator/model-facing control surface
- Strategy: `adapter`

### Recipe E - extract the tool inventory composer

- Carry: [`src/agents/openclaw-tools.ts`](../../src/agents/openclaw-tools.ts), [`src/agents/openclaw-plugin-tools.ts`](../../src/agents/openclaw-plugin-tools.ts)
- Keep together: `createOpenClawTools`, `resolveOpenClawPluginToolsForOptions`
- Replace with shims: concrete tool factories, gateway caller, workspace/session resolution, and plugin tool metadata format
- Best use: hosts that want a single place to assemble model-visible tools while keeping plugin tools late-bound
- Strategy: `adapter`

### Recipe F - extract the small hook-side LLM helper

- Carry: [`src/hooks/llm-slug-generator.ts`](../../src/hooks/llm-slug-generator.ts)
- Keep together: `generateSlugViaLLM`
- Replace with shims: agent/runtime selection, temp-session file policy, and cleanup path
- Best use: small in-product helper calls that need a bounded single-shot model invocation instead of the full command/runtime bridge
- Strategy: `copier` with light adaptation

## do not copy blindly

- [`src/agents/pi-embedded-runner/run/attempt.ts`](../../src/agents/pi-embedded-runner/run/attempt.ts) is not a safe copy target. It assumes OpenClaw's session format, prompt lifecycle, tool schema/runtime contract, provider quirks, sandbox model, and transcript repair policy all at once.
- [`src/agents/pi-embedded-runner/run.ts`](../../src/agents/pi-embedded-runner/run.ts) looks like an orchestrator, but it encodes real product behavior around auth-profile rotation, live model switching, retry policy, compaction recovery, and usage accounting.
- [`src/agents/agent-command.ts`](../../src/agents/agent-command.ts) mixes trust defaults, session bookkeeping, delivery policy, runtime configuration, and result fanout. Reusing it outside the same trust boundary is dangerous.
- [`src/agents/subagent-registry.ts`](../../src/agents/subagent-registry.ts) owns process-global timers, listeners, restore state, and persistence semantics. Partial copies create orphaned or duplicate lifecycle state.
- [`src/agents/tools/sessions-spawn-tool.ts`](../../src/agents/tools/sessions-spawn-tool.ts) and [`src/agents/tools/sessions-send-tool.ts`](../../src/agents/tools/sessions-send-tool.ts) speak OpenClaw-specific gateway/session contracts such as `agent`, `sessions.resolve`, `sessions.patch`, and visibility rules.
- [`src/agents/models-config.ts`](../../src/agents/models-config.ts) writes shared files in the agent directory and caches readiness by fingerprint. Copying it without the same config/runtime layout will silently produce stale model catalogs.
- [`src/agents/auth-profiles/store.ts`](../../src/agents/auth-profiles/store.ts) persists on-disk profile state and runtime snapshots. Treat the store format and paths as host policy, not generic infrastructure.
- [`src/auto-reply/reply/agent-runner.ts`](../../src/auto-reply/reply/agent-runner.ts) is heavily shaped by reply delivery semantics, typing, follow-up queues, and block streaming. It is much more integration glue than reusable runtime core.

## minimal reusable slices

### Slice: model-ref selection and allowlist pack

- Paths: [`src/agents/model-selection.ts`](../../src/agents/model-selection.ts)
- Central symbols: `buildModelAliasIndex`, `resolveConfiguredModelRef`, `resolveAllowedModelRef`, `resolveSubagentSpawnModelSelection`
- Why minimal: this is the cleanest policy-heavy slice in the batch and it solves a recurring agent-host problem before any transport/runtime code is copied
- Strategy: `adapter`

### Slice: model fallback executor

- Paths: [`src/agents/model-fallback.ts`](../../src/agents/model-fallback.ts)
- Central symbols: `runWithModelFallback`, `runWithImageModelFallback`, `FallbackSummaryError`
- Why minimal: the caller can provide its own run function, so the fallback shell is more reusable than the rest of the runner
- Strategy: `adapter`

### Slice: auth-profile ordering and cooldown kernel

- Paths: [`src/agents/auth-profiles/order.ts`](../../src/agents/auth-profiles/order.ts), [`src/agents/auth-profiles/usage.ts`](../../src/agents/auth-profiles/usage.ts), [`src/agents/auth-profiles/types.ts`](../../src/agents/auth-profiles/types.ts)
- Central symbols: `resolveAuthProfileEligibility`, `resolveAuthProfileOrder`, `markAuthProfileFailure`, `markAuthProfileUsed`, `resolveProfilesUnavailableReason`
- Why minimal: it captures a real multi-provider policy layer without forcing you to adopt the whole embedded runner
- Strategy: `adapter`

### Slice: subagent control shell

- Paths: [`src/agents/subagent-control.ts`](../../src/agents/subagent-control.ts), [`src/agents/tools/subagents-tool.ts`](../../src/agents/tools/subagents-tool.ts)
- Central symbols: `resolveSubagentController`, `killControlledSubagentRun`, `steerControlledSubagentRun`, `sendControlledSubagentMessage`, `createSubagentsTool`
- Why minimal: this is the smallest slice that turns a registry of child runs into an operator/model-facing control surface
- Strategy: `adapter`

### Slice: hook-side one-shot LLM helper

- Paths: [`src/hooks/llm-slug-generator.ts`](../../src/hooks/llm-slug-generator.ts)
- Central symbols: `generateSlugViaLLM`
- Why minimal: small and easy to transplant when the target host already exposes a one-shot embedded run entry
- Strategy: `copier` with light adaptation

## exact search shortcuts

- `rg "runEmbeddedPiAgent|backfillSessionKey|resolveAuthProfileOrder|runEmbeddedAttempt" src/agents/pi-embedded-runner`
- `rg "runEmbeddedAttempt|createOpenClawCodingTools|getOrCreateSessionMcpRuntime|resolveEmbeddedAgentStreamFn" src/agents/pi-embedded-runner src/agents`
- `rg "createOpenClawTools|resolveOpenClawPluginToolsForOptions|createSessionsSpawnTool|createSessionsSendTool|createSubagentsTool" src/agents`
- `rg "spawnSubagentDirect|registerSubagentRun|scheduleSubagentOrphanRecovery|resolveSubagentController|steerControlledSubagentRun" src/agents`
- `rg "resolveAuthProfileEligibility|resolveAuthProfileOrder|ensureAuthProfileStore|markAuthProfileFailure|markAuthProfileUsed|syncExternalCliCredentials" src/agents/auth-profiles* src/agents`
- `rg "buildModelAliasIndex|resolveConfiguredModelRef|resolveAllowedModelRef|ensureOpenClawModelsJson|runWithModelFallback" src/agents`
- `rg "agentCommandFromIngress|prepareAgentCommandExecution|runReplyAgent|runAgentTurnWithFallback|generateSlugViaLLM" src/agents src/auto-reply src/hooks`
- `rg "sessions_spawn|sessions_send|subagents" src/agents/tools src/agents`
