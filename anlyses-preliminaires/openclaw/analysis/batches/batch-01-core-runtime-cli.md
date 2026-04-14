# Batch 01 - Core Runtime and CLI

Scope: `2267` files. Main concentration: [`src/infra/`](../../src/infra), [`src/commands/`](../../src/commands), [`src/cli/`](../../src/cli), [`src/config/`](../../src/config), [`src/secrets/`](../../src/secrets), [`src/security/`](../../src/security).

## purpose

This batch is the bootstrap spine of OpenClaw. It owns CLI startup, argument routing, config and session loading, shared runtime/env normalization, secret resolution, and the library-facing facade that the rest of the repository fans into.

For extraction work, the useful question is not "how does the whole CLI work?" but "which tiny kernels are portable without inheriting the full host?" The best kernels here are the root-help/version bootstrap, the `SecretRef` contract plus resolver, the path/runtime helpers, and the lazy library export pattern. The dangerous areas are config IO, session storage, and command registration because they already encode OpenClaw-specific filesystem layout, plugin validation, and global process behavior.

## entrypoints

- [`openclaw.mjs`](../../openclaw.mjs): Node launcher that validates Node version, tries the bare root-help fast path, installs warning filtering, and loads built entry output.
- [`src/entry.ts`](../../src/entry.ts): TypeScript main entry with respawn, profile/container preprocessing, root help/version fast paths, and final handoff into the real CLI runtime.
- [`src/cli/run-main.ts`](../../src/cli/run-main.ts): effective CLI runtime bootstrap, `.env` loading, runtime checks, lazy command registration, and plugin CLI injection.
- [`src/index.ts`](../../src/index.ts): package-root shim that keeps the CLI path lean while exposing lazy library exports for consumers.
- [`src/library.ts`](../../src/library.ts): lazy export surface for consumers that need OpenClaw as a library instead of as a CLI.

## key files

- [`src/cli/argv.ts`](../../src/cli/argv.ts): reusable root-option and command-path parser used by fast paths and lazy command registration.
- [`src/cli/argv-invocation.ts`](../../src/cli/argv-invocation.ts): normalized invocation DTO shared by startup policies.
- [`src/cli/program/build-program.ts`](../../src/cli/program/build-program.ts): Commander root builder and exit-code preservation hook.
- [`src/cli/program/command-registry.ts`](../../src/cli/program/command-registry.ts): lazy registration map for built-in command groups.
- [`src/cli/program/register.subclis.ts`](../../src/cli/program/register.subclis.ts): lazy registration map for sub-CLIs plus plugin-aware ordering.
- [`src/plugins/cli.ts`](../../src/plugins/cli.ts): validated-config gate for plugin CLI command discovery and registration.
- [`src/config/io.ts`](../../src/config/io.ts): real config IO implementation behind the barrel in [`src/config/config.ts`](../../src/config/config.ts).
- [`src/config/paths.ts`](../../src/config/paths.ts): state-dir/config-path/gateway-port resolution rules.
- [`src/config/sessions/store.ts`](../../src/config/sessions/store.ts): session-store update surface with caching, maintenance, and locking.
- [`src/config/sessions/paths.ts`](../../src/config/sessions/paths.ts): session file/path resolution rules under the state directory.
- [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts): `SecretRef` identifier rules and provider-default resolution.
- [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts): bounded env/file/exec secret-resolution engine.
- [`src/runtime.ts`](../../src/runtime.ts): process/runtime contract used by CLI and library consumers.
- [`src/infra/env.ts`](../../src/infra/env.ts): env normalization and truthy parsing helpers.
- [`src/shared/string-coerce.ts`](../../src/shared/string-coerce.ts): high-fanout normalization utilities reused across config, CLI, sessions, and plugins.

## data flow

- [`openclaw.mjs`](../../openclaw.mjs) validates Node, optionally enables compile cache, tries precomputed root help, then imports the built entry output from `dist/`.
- [`src/entry.ts`](../../src/entry.ts) normalizes argv/env, installs lightweight process guards, performs respawn if startup `NODE_OPTIONS` or CA-certs must be injected, handles root version/help fast paths, then lazy-imports [`src/cli/run-main.ts`](../../src/cli/run-main.ts).
- [`src/cli/run-main.ts`](../../src/cli/run-main.ts) parses container/profile flags again for the real runtime, loads `.env`, normalizes runtime env, builds the Commander program, registers the primary command lazily, and injects plugin CLI commands only if the invocation needs them.
- Command handlers eventually resolve runtime config through [`src/config/io.ts`](../../src/config/io.ts) and session state through [`src/config/sessions/`](../../src/config/sessions), then fan out into gateway, agent, and plugin code.
- Secret-bearing config values and provider references resolve through [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts) and [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts), which bridge config types, filesystem safety checks, JSON-pointer reads, and exec/file/env providers.
- Library consumers bypass the CLI entry path: [`src/index.ts`](../../src/index.ts) only lazy-binds exports from [`src/library.ts`](../../src/library.ts) when imported as a library, which avoids paying the CLI startup cost.

## external deps

- `commander` drives the command graph in [`src/cli/program/`](../../src/cli/program).
- `json5` is part of the config file pipeline in [`src/config/io.ts`](../../src/config/io.ts).
- Node built-ins dominate bootstrap, filesystem, process, and secret-resolution code across [`openclaw.mjs`](../../openclaw.mjs), [`src/entry.ts`](../../src/entry.ts), [`src/config/`](../../src/config), and [`src/secrets/`](../../src/secrets).
- Config validation is partly schema-driven through the generated `OpenClawSchema` imported by [`src/config/validation.ts`](../../src/config/validation.ts).

## flags/env

- `NODE_DISABLE_COMPILE_CACHE` is checked in [`openclaw.mjs`](../../openclaw.mjs) and [`src/entry.ts`](../../src/entry.ts).
- `OPENCLAW_NO_RESPAWN`, `OPENCLAW_NODE_OPTIONS_READY`, and `OPENCLAW_NODE_EXTRA_CA_CERTS_READY` gate respawn logic in [`src/entry.respawn.ts`](../../src/entry.respawn.ts).
- `OPENCLAW_AUTH_STORE_READONLY` is forced for the `secrets audit` path in [`src/entry.ts`](../../src/entry.ts).
- `NO_COLOR` and `FORCE_COLOR` are normalized in [`src/entry.ts`](../../src/entry.ts).
- `OPENCLAW_CONTAINER` participates in container-target resolution in [`src/entry.ts`](../../src/entry.ts) and [`src/cli/run-main.ts`](../../src/cli/run-main.ts).
- `OPENCLAW_STATE_DIR`, `OPENCLAW_CONFIG_PATH`, `OPENCLAW_HOME`, `OPENCLAW_TEST_FAST`, and `OPENCLAW_NIX_MODE` shape the filesystem layout in [`src/config/paths.ts`](../../src/config/paths.ts).
- `OPENCLAW_GATEWAY_PORT` overrides the default gateway port in [`src/config/paths.ts`](../../src/config/paths.ts).
- `.env` auto-loading from cwd or state-dir is handled by [`src/cli/run-main.ts`](../../src/cli/run-main.ts) together with [`src/cli/dotenv.ts`](../../src/cli/dotenv.ts).

## subdomains

### CLI launcher and fast paths

Classification: `runtime central` plus `glue`.

Anchors:

- [`openclaw.mjs`](../../openclaw.mjs)
- [`src/entry.ts`](../../src/entry.ts)
- [`src/entry.respawn.ts`](../../src/entry.respawn.ts)
- [`src/cli/argv.ts`](../../src/cli/argv.ts)
- [`src/cli/argv-invocation.ts`](../../src/cli/argv-invocation.ts)
- [`src/cli/run-main.ts`](../../src/cli/run-main.ts)

This is the cheapest startup layer in the repo. It exists to answer `--help` and `--version`, normalize process state, and decide whether OpenClaw should even pay the cost of building the full program graph.

### Lazy command graph and plugin CLI injection

Classification: `glue` plus `adapters`.

Anchors:

- [`src/cli/program/build-program.ts`](../../src/cli/program/build-program.ts)
- [`src/cli/program/command-registry.ts`](../../src/cli/program/command-registry.ts)
- [`src/cli/program/register.subclis.ts`](../../src/cli/program/register.subclis.ts)
- [`src/plugins/cli.ts`](../../src/plugins/cli.ts)

This layer is mostly registration policy, not business logic. Its value is the lazy graph pattern and the ability to inject plugin-owned commands only after config has been validated.

### Config IO and validation runtime

Classification: `runtime central`.

Anchors:

- [`src/config/io.ts`](../../src/config/io.ts)
- [`src/config/paths.ts`](../../src/config/paths.ts)
- [`src/config/includes.ts`](../../src/config/includes.ts)
- [`src/config/env-substitution.ts`](../../src/config/env-substitution.ts)
- [`src/config/validation.ts`](../../src/config/validation.ts)

This is the real config kernel. It combines JSON5 parsing, include expansion, env substitution, raw/runtime validation, runtime snapshot caching, write-back preparation, and a long tail of compatibility rules.

### Session state and transcript storage

Classification: `runtime central`.

Anchors:

- [`src/config/sessions/paths.ts`](../../src/config/sessions/paths.ts)
- [`src/config/sessions/session-key.ts`](../../src/config/sessions/session-key.ts)
- [`src/config/sessions/main-session.ts`](../../src/config/sessions/main-session.ts)
- [`src/config/sessions/store.ts`](../../src/config/sessions/store.ts)
- [`src/config/sessions/transcript.ts`](../../src/config/sessions/transcript.ts)

This is not just "save a JSON file". It encodes the repository's session-key model, store layout, locking rules, maintenance budget, transcript mirroring, and agent-specific filesystem conventions.

### Secret reference contract and secure resolvers

Classification: `adapters` plus `runtime central`.

Anchors:

- [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts)
- [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts)
- [`src/secrets/shared.ts`](../../src/secrets/shared.ts)

This is one of the best medium-sized reuse targets in the batch. The contract is generic enough to transplant, while the resolver already carries concurrency limits, size guards, provider-scoped errors, and path safety checks.

### Shared runtime/env helpers and library facade

Classification: `runtime central` plus `glue`.

Anchors:

- [`src/runtime.ts`](../../src/runtime.ts)
- [`src/infra/env.ts`](../../src/infra/env.ts)
- [`src/shared/string-coerce.ts`](../../src/shared/string-coerce.ts)
- [`src/library.ts`](../../src/library.ts)
- [`src/index.ts`](../../src/index.ts)

This layer is less dramatic than config or sessions, but it contains several small reusable seams: runtime JSON writing, string/env normalization, and the "lazy library exports on import, real CLI on main entry" pattern.

## feature inventory

### Root help/version bootstrap and respawn shell

- Goal: keep `openclaw --help` and root version output cheap while preserving a path to the full runtime only when needed.
- Open first: [`openclaw.mjs`](../../openclaw.mjs), [`src/entry.ts`](../../src/entry.ts), [`src/entry.respawn.ts`](../../src/entry.respawn.ts), [`src/cli/argv.ts`](../../src/cli/argv.ts)
- Pivot symbols: `ensureSupportedNodeVersion`, `tryOutputBareRootHelp`, `buildMissingEntryErrorMessage`, `tryHandleRootHelpFastPath`, `isRootVersionInvocation`, `buildCliRespawnPlan`
- Strictly required modules: [`src/cli/argv.ts`](../../src/cli/argv.ts), [`src/entry.respawn.ts`](../../src/entry.respawn.ts), [`src/infra/env.ts`](../../src/infra/env.ts), and a local replacement for the final `runCli` handoff
- Dangerous couplings: mutates `process.argv` and `process.env`, installs process-wide error handlers, depends on precomputed root-help output, and assumes container/profile flags exist
- Reuse strategy: `adapter`

### Lazy Commander graph with plugin CLI injection

- Goal: register only the built-in or sub-CLI command groups that the current invocation actually needs, then inject plugin commands from validated config when appropriate.
- Open first: [`src/cli/program/build-program.ts`](../../src/cli/program/build-program.ts), [`src/cli/program/command-registry.ts`](../../src/cli/program/command-registry.ts), [`src/cli/program/register.subclis.ts`](../../src/cli/program/register.subclis.ts), [`src/plugins/cli.ts`](../../src/plugins/cli.ts)
- Pivot symbols: `buildProgram`, `registerCoreCliByName`, `registerCoreCliCommands`, `registerProgramCommands`, `registerSubCliWithPluginCommands`, `registerPluginCliCommandsFromValidatedConfig`
- Strictly required modules: the `commander` setup in [`src/cli/program/build-program.ts`](../../src/cli/program/build-program.ts), the registration specs in [`src/cli/program/command-registry.ts`](../../src/cli/program/command-registry.ts), and [`src/plugins/cli.ts`](../../src/plugins/cli.ts) if plugin injection stays
- Dangerous couplings: command names are hard-coded, registration order matters for `pairing` and `plugins`, and plugin command registration depends on validated runtime config
- Reuse strategy: `adapter`

### Config IO pipeline with snapshot caching and write-back preservation

- Goal: load JSON5 config through include expansion and env substitution, validate it, cache runtime snapshots, and write back changes without destroying env placeholders or source-shape intent.
- Open first: [`src/config/io.ts`](../../src/config/io.ts), [`src/config/paths.ts`](../../src/config/paths.ts), [`src/config/includes.ts`](../../src/config/includes.ts), [`src/config/env-substitution.ts`](../../src/config/env-substitution.ts), [`src/config/validation.ts`](../../src/config/validation.ts)
- Pivot symbols: `createConfigIO`, `resolveConfigSnapshotHash`, `ConfigRuntimeRefreshError`, `loadConfig`, `readConfigFileSnapshot`, `writeConfigFile`, `projectConfigOntoRuntimeSourceSnapshot`, `resolveConfigIncludes`, `resolveConfigEnvVars`, `validateConfigObjectWithPlugins`
- Strictly required modules: [`src/config/io.ts`](../../src/config/io.ts), [`src/config/paths.ts`](../../src/config/paths.ts), [`src/config/includes.ts`](../../src/config/includes.ts), [`src/config/env-substitution.ts`](../../src/config/env-substitution.ts), runtime-snapshot support, and whichever validation strategy replaces OpenClaw-specific plugin checks
- Dangerous couplings: doctor migrations, backup rotation, config-audit logging, owner-display secret persistence, plugin manifest validation, bundled-channel schema metadata, and runtime snapshot globals all live inside or below this surface
- Reuse strategy: `adapter`

### Session keying, store paths, and lock-safe store updates

- Goal: derive stable session keys, resolve transcript/store paths, and safely mutate session stores with maintenance and transcript side effects.
- Open first: [`src/config/sessions/paths.ts`](../../src/config/sessions/paths.ts), [`src/config/sessions/session-key.ts`](../../src/config/sessions/session-key.ts), [`src/config/sessions/main-session.ts`](../../src/config/sessions/main-session.ts), [`src/config/sessions/store.ts`](../../src/config/sessions/store.ts)
- Pivot symbols: `resolveDefaultSessionStorePath`, `resolveStorePath`, `deriveSessionKey`, `resolveSessionKey`, `resolveMainSessionKey`, `loadSessionStore`, `saveSessionStore`, `updateSessionStore`, `updateSessionStoreEntry`
- Strictly required modules: [`src/config/sessions/paths.ts`](../../src/config/sessions/paths.ts), [`src/config/sessions/store.ts`](../../src/config/sessions/store.ts), the session entry types in [`src/config/sessions/types.ts`](../../src/config/sessions/types.ts), and a write-lock implementation
- Dangerous couplings: assumes the OpenClaw state-dir layout, imports gateway archive runtime lazily, maintains global lock queues, and merges delivery-context/session metadata using host-specific message models
- Reuse strategy: `adapter`

### SecretRef contract and bounded resolver

- Goal: resolve `env`, `file`, and `exec` secret refs through provider aliases with bounded concurrency, size/time limits, JSON-pointer support, and typed error scopes.
- Open first: [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts), [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts), [`src/secrets/shared.ts`](../../src/secrets/shared.ts)
- Pivot symbols: `secretRefKey`, `resolveDefaultSecretProviderAlias`, `validateExecSecretRefId`, `resolveSecretRefValues`, `resolveSecretRefValue`, `resolveSecretRefString`, `SecretProviderResolutionError`, `SecretRefResolutionError`
- Strictly required modules: [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts), [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts), [`src/secrets/shared.ts`](../../src/secrets/shared.ts), [`src/secrets/json-pointer.ts`](../../src/secrets/json-pointer.ts), and replacements for the imported config secret-provider types
- Dangerous couplings: provider config shapes come from [`src/config/types.secrets.ts`](../../src/config/types.secrets.ts), filesystem safety depends on [`src/security/audit-fs.ts`](../../src/security/audit-fs.ts) and [`src/security/scan-paths.ts`](../../src/security/scan-paths.ts), and `exec` refs deliberately spawn external commands
- Reuse strategy: `adapter`

### Lazy library facade and runtime output contract

- Goal: expose a compact library API that only loads heavy runtime modules on demand while keeping the CLI entry path isolated.
- Open first: [`src/library.ts`](../../src/library.ts), [`src/index.ts`](../../src/index.ts), [`src/runtime.ts`](../../src/runtime.ts), [`src/infra/env.ts`](../../src/infra/env.ts), [`src/shared/string-coerce.ts`](../../src/shared/string-coerce.ts)
- Pivot symbols: `getReplyFromConfig`, `promptYesNo`, `ensureBinary`, `runExec`, `runCommandWithTimeout`, `monitorWebChannel`, `runLegacyCliEntry`, `defaultRuntime`, `createNonExitingRuntime`, `writeRuntimeJson`, `normalizeEnv`
- Strictly required modules: only the specific lazily imported runtimes you want to keep, plus [`src/runtime.ts`](../../src/runtime.ts) if you reuse the process/runtime contract
- Dangerous couplings: the exported surface currently assumes auto-reply, binaries, exec runtime, and web-channel runtime all exist; [`src/index.ts`](../../src/index.ts) also acts as a legacy executable entry file
- Reuse strategy: `copier` for the facade pattern, `adapter` for the concrete export set

## symbol map

### Launcher and argv normalization

- [`openclaw.mjs`](../../openclaw.mjs): `ensureSupportedNodeVersion`, `tryOutputBareRootHelp`, `buildMissingEntryErrorMessage`
- [`src/entry.ts`](../../src/entry.ts): `tryHandleRootHelpFastPath`, `runMainOrRootHelp`
- [`src/entry.respawn.ts`](../../src/entry.respawn.ts): `buildCliRespawnPlan`, `hasExperimentalWarningSuppressed`, `EXPERIMENTAL_WARNING_FLAG`, `OPENCLAW_NODE_OPTIONS_READY`, `OPENCLAW_NODE_EXTRA_CA_CERTS_READY`
- [`src/cli/argv.ts`](../../src/cli/argv.ts): `hasHelpOrVersion`, `isRootVersionInvocation`, `isRootHelpInvocation`, `getCommandPathWithRootOptions`, `buildParseArgv`, `shouldMigrateState`
- [`src/cli/argv-invocation.ts`](../../src/cli/argv-invocation.ts): `resolveCliArgvInvocation`
- [`src/cli/run-main.ts`](../../src/cli/run-main.ts): `rewriteUpdateFlagArgv`, `shouldEnsureCliPath`, `shouldUseRootHelpFastPath`, `resolveMissingPluginCommandMessage`, `runCli`, `isCliMainModule`

### Command graph and registration seams

- [`src/cli/program/build-program.ts`](../../src/cli/program/build-program.ts): `buildProgram`
- [`src/cli/program/command-registry.ts`](../../src/cli/program/command-registry.ts): `registerCoreCliByName`, `registerCoreCliCommands`, `registerProgramCommands`, `getCoreCliCommandNames`
- [`src/cli/program/register.subclis.ts`](../../src/cli/program/register.subclis.ts): `registerSubCliWithPluginCommands`, `getSubCliEntries`, `registerSubCliByName`, `registerSubCliCommands`
- [`src/plugins/cli.ts`](../../src/plugins/cli.ts): `loadValidatedConfigForPluginRegistration`, `getPluginCliCommandDescriptors`, `registerPluginCliCommands`, `registerPluginCliCommandsFromValidatedConfig`

### Config and session runtime

- [`src/config/io.ts`](../../src/config/io.ts): `createConfigIO`, `resolveConfigSnapshotHash`, `ConfigRuntimeRefreshError`, `clearConfigCache`, `registerConfigWriteListener`, `projectConfigOntoRuntimeSourceSnapshot`, `loadConfig`, `getRuntimeConfig`, `readConfigFileSnapshot`, `writeConfigFile`
- [`src/config/paths.ts`](../../src/config/paths.ts): `resolveStateDir`, `resolveConfigPath`, `resolveCanonicalConfigPath`, `resolveGatewayPort`, `resolveOAuthDir`, `resolveOAuthPath`
- [`src/config/includes.ts`](../../src/config/includes.ts): `resolveConfigIncludes`, `readConfigIncludeFileWithGuards`, `deepMerge`, `ConfigIncludeError`, `CircularIncludeError`
- [`src/config/env-substitution.ts`](../../src/config/env-substitution.ts): `resolveConfigEnvVars`, `containsEnvVarReference`, `MissingEnvVarError`
- [`src/config/validation.ts`](../../src/config/validation.ts): `validateConfigObjectRaw`, `validateConfigObject`, `validateConfigObjectWithPlugins`, `validateConfigObjectRawWithPlugins`, `collectUnsupportedSecretRefPolicyIssues`
- [`src/config/sessions/paths.ts`](../../src/config/sessions/paths.ts): `resolveSessionTranscriptsDir`, `resolveSessionTranscriptsDirForAgent`, `resolveDefaultSessionStorePath`, `resolveSessionFilePath`, `resolveStorePath`, `validateSessionId`
- [`src/config/sessions/session-key.ts`](../../src/config/sessions/session-key.ts): `deriveSessionKey`, `resolveSessionKey`
- [`src/config/sessions/main-session.ts`](../../src/config/sessions/main-session.ts): `resolveMainSessionKey`, `resolveAgentMainSessionKey`, `resolveExplicitAgentSessionKey`, `canonicalizeMainSessionAlias`
- [`src/config/sessions/store.ts`](../../src/config/sessions/store.ts): `normalizeStoreSessionKey`, `resolveSessionStoreEntry`, `loadSessionStore`, `saveSessionStore`, `updateSessionStore`, `updateSessionStoreEntry`, `recordSessionMetaFromInbound`, `updateLastRoute`

### Secrets, runtime, and small helpers

- [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts): `SECRET_PROVIDER_ALIAS_PATTERN`, `SINGLE_VALUE_FILE_REF_ID`, `FILE_SECRET_REF_ID_PATTERN`, `EXEC_SECRET_REF_ID_JSON_SCHEMA_PATTERN`, `secretRefKey`, `resolveDefaultSecretProviderAlias`, `isValidFileSecretRefId`, `validateExecSecretRefId`, `formatExecSecretRefIdValidationMessage`
- [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts): `SecretProviderResolutionError`, `SecretRefResolutionError`, `isProviderScopedSecretResolutionError`, `resolveSecretRefValues`, `resolveSecretRefValue`, `resolveSecretRefString`
- [`src/secrets/shared.ts`](../../src/secrets/shared.ts): `parseDotPath`, `toDotPath`, `ensureDirForFile`, `writeJsonFileSecure`, `writeTextFileAtomic`
- [`src/runtime.ts`](../../src/runtime.ts): `RuntimeEnv`, `OutputRuntimeEnv`, `defaultRuntime`, `createNonExitingRuntime`, `writeRuntimeJson`
- [`src/infra/env.ts`](../../src/infra/env.ts): `logAcceptedEnvOption`, `normalizeZaiEnv`, `isTruthyEnvValue`, `normalizeEnv`
- [`src/shared/string-coerce.ts`](../../src/shared/string-coerce.ts): `readStringValue`, `normalizeNullableString`, `normalizeOptionalString`, `normalizeOptionalLowercaseString`, `normalizeLowercaseStringOrEmpty`, `resolvePrimaryStringValue`, `hasNonEmptyString`
- [`src/library.ts`](../../src/library.ts): `getReplyFromConfig`, `promptYesNo`, `ensureBinary`, `runExec`, `runCommandWithTimeout`, `monitorWebChannel`
- [`src/index.ts`](../../src/index.ts): `runLegacyCliEntry`

## dependency map

### Internal dependencies you must carry together

- CLI fast paths depend on [`src/cli/argv.ts`](../../src/cli/argv.ts), [`src/entry.respawn.ts`](../../src/entry.respawn.ts), and the final handoff in [`src/cli/run-main.ts`](../../src/cli/run-main.ts). If you keep container/profile behavior, you also inherit [`src/cli/container-target.ts`](../../src/cli/container-target.ts) and [`src/cli/profile.ts`](../../src/cli/profile.ts).
- Lazy command registration depends on the Commander setup in [`src/cli/program/build-program.ts`](../../src/cli/program/build-program.ts), the registration specs in [`src/cli/program/command-registry.ts`](../../src/cli/program/command-registry.ts), and plugin registration in [`src/plugins/cli.ts`](../../src/plugins/cli.ts) if external/plugin commands remain.
- Config IO depends on [`src/config/paths.ts`](../../src/config/paths.ts), [`src/config/includes.ts`](../../src/config/includes.ts), [`src/config/env-substitution.ts`](../../src/config/env-substitution.ts), runtime snapshot state, write-preparation helpers, and validation.
- Session storage depends on [`src/config/sessions/types.ts`](../../src/config/sessions/types.ts), [`src/config/sessions/store-load.ts`](../../src/config/sessions/store-load.ts), [`src/config/sessions/store-maintenance.ts`](../../src/config/sessions/store-maintenance.ts), and a write-lock implementation.
- Secret resolution depends on [`src/config/types.secrets.ts`](../../src/config/types.secrets.ts), [`src/secrets/json-pointer.ts`](../../src/secrets/json-pointer.ts), [`src/security/audit-fs.ts`](../../src/security/audit-fs.ts), [`src/security/scan-paths.ts`](../../src/security/scan-paths.ts), and [`src/utils/run-with-concurrency.ts`](../../src/utils/run-with-concurrency.ts).
- The library facade depends on every lazy runtime it re-exports. If one target runtime does not exist in the extracted project, the corresponding export must be dropped or rewritten.

### External dependencies

- `commander` is a hard dependency for the current command graph.
- `json5` is a hard dependency for current config parsing.
- Node built-ins are deeply embedded in launcher, config, sessions, and secret resolution.
- The validation layer leans on generated schema code rather than just plain objects, so schema generation or replacement validation logic must exist.

### Runtime and config assumptions

- Global `process.argv`, `process.env`, `process.title`, unhandled-rejection handlers, and uncaught-exception handlers are mutated directly by the CLI entry path.
- Filesystem layout assumes `~/.openclaw` plus legacy `.clawdbot` compatibility, and many path helpers default to the current user's home directory.
- Plugin-aware validation assumes a working plugin manifest registry and bundled channel metadata even when the feature being validated is "just config".
- Session storage assumes agent-aware directory layout under the resolved state dir.

### Glue that is safe to rewrite

- Fetch compatibility, warning filtering, console-capture setup, and container/profile preprocessing are useful but not core to the extraction target.
- Command-group descriptor tables in [`src/cli/program/command-registry.ts`](../../src/cli/program/command-registry.ts) and [`src/cli/program/register.subclis.ts`](../../src/cli/program/register.subclis.ts) are host-specific glue and should usually be rewritten.
- Config audit logging, backup rotation, and owner-display side effects are peripheral and can be replaced by simpler hooks in another host.

## extraction recipes

### Recipe A - transplant the root fast-path shell

- Carry: [`openclaw.mjs`](../../openclaw.mjs), [`src/entry.ts`](../../src/entry.ts), [`src/entry.respawn.ts`](../../src/entry.respawn.ts), [`src/cli/argv.ts`](../../src/cli/argv.ts), [`src/cli/argv-invocation.ts`](../../src/cli/argv-invocation.ts)
- Keep together: `tryOutputBareRootHelp`, `tryHandleRootHelpFastPath`, `isRootHelpInvocation`, `isRootVersionInvocation`, `buildCliRespawnPlan`
- Replace with shims: [`src/cli/container-target.ts`](../../src/cli/container-target.ts), [`src/cli/profile.ts`](../../src/cli/profile.ts), fetch compat, warning filter, and the final `runCli` target
- Best use: a CLI that needs extremely cheap root help/version and occasional respawn to inject runtime flags
- Strategy: `adapter`

### Recipe B - extract the SecretRef kernel

- Carry: [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts), [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts), [`src/secrets/shared.ts`](../../src/secrets/shared.ts), [`src/secrets/json-pointer.ts`](../../src/secrets/json-pointer.ts)
- Keep together: `secretRefKey`, provider-default resolution, exec-id validation, `resolveSecretRefValues`, typed resolution errors, secure file-write helpers
- Replace with shims: secret-provider config types, `resolveUserPath`, path-audit helpers, and any host-specific policy around allowed providers
- Best use: an agent host that needs env/file/exec secret backends without inventing a new secret-reference grammar
- Strategy: `adapter`

### Recipe C - extract the config IO kernel, not the whole config stack

- Carry: [`src/config/io.ts`](../../src/config/io.ts), [`src/config/paths.ts`](../../src/config/paths.ts), [`src/config/includes.ts`](../../src/config/includes.ts), [`src/config/env-substitution.ts`](../../src/config/env-substitution.ts)
- Keep together: `createConfigIO`, snapshot hashing, include/env resolution, raw snapshot reads, write-back preservation helpers
- Replace with shims: plugin-aware validation, backup/audit hooks, owner-display secret persistence, and legacy migration rules
- Best use: a host with JSON5 config files that wants include/env support and conflict-aware writes without taking plugin registries along
- Strategy: `adapter`

### Recipe D - extract the library facade pattern

- Carry: [`src/library.ts`](../../src/library.ts), [`src/index.ts`](../../src/index.ts), [`src/runtime.ts`](../../src/runtime.ts)
- Keep together: lazy runtime promises, explicit library exports, `runLegacyCliEntry`, runtime JSON writing
- Replace with shims: the concrete runtime modules behind each exported function
- Best use: a package that is both an executable CLI and an importable library, but wants to keep startup cost low for each mode
- Strategy: `copier` for the pattern, `adapter` for the export list

### Recipe E - extract session-key and store-path rules only

- Carry: [`src/config/sessions/session-key.ts`](../../src/config/sessions/session-key.ts), [`src/config/sessions/main-session.ts`](../../src/config/sessions/main-session.ts), [`src/config/sessions/paths.ts`](../../src/config/sessions/paths.ts)
- Keep together: `deriveSessionKey`, `resolveSessionKey`, `resolveMainSessionKey`, `resolveDefaultSessionStorePath`, `resolveStorePath`
- Replace with shims: agent-id normalization and any host-specific path layout below the state dir
- Best use: a future agentic project that wants stable session identity and per-agent session storage without inheriting transcript maintenance and locking yet
- Strategy: `adapter`

## do not copy blindly

- [`src/config/io.ts`](../../src/config/io.ts) is not only "read/write config". It also owns snapshot refresh, invalid-config recovery, env-ref restoration, backup rotation, config audit logging, runtime defaulting, and plugin-aware validation.
- [`src/config/validation.ts`](../../src/config/validation.ts) is not a generic schema validator. It imports plugin manifest registries, bundled channel metadata, agent workspace rules, and OpenClaw-specific doctor compatibility logic.
- [`src/config/sessions/store.ts`](../../src/config/sessions/store.ts) assumes global lock state and OpenClaw session-maintenance rules. Blind copy pulls in hidden lifecycle and storage semantics.
- [`src/entry.ts`](../../src/entry.ts) mutates `process.argv`, `process.env`, and installs global process handlers. That is fine for a top-level executable, but dangerous inside another embedding host.
- [`src/cli/program/register.subclis.ts`](../../src/cli/program/register.subclis.ts) hardcodes the command universe and special plugin ordering rules. It is an index of OpenClaw subcommands, not a portable abstraction.
- [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts) intentionally executes child processes for `exec` refs and enforces filesystem safety policies. Reuse requires an explicit trust and sandbox decision.
- [`src/library.ts`](../../src/library.ts) only works if all of its lazy imports exist in the new repo. Copying it without pruning exports creates runtime import failures that are easy to miss.
- [`src/config/paths.ts`](../../src/config/paths.ts) preserves rebrand compatibility with `.clawdbot`. Keep that behavior only if you also want the migration surface.

## minimal reusable slices

### Slice: argv fast-path microkernel

- Paths: [`src/cli/argv.ts`](../../src/cli/argv.ts), [`src/cli/argv-invocation.ts`](../../src/cli/argv-invocation.ts), [`src/entry.respawn.ts`](../../src/entry.respawn.ts)
- Central symbols: `isRootHelpInvocation`, `isRootVersionInvocation`, `getCommandPathWithRootOptions`, `resolveCliArgvInvocation`, `buildCliRespawnPlan`
- Why minimal: you can reuse root-option parsing and respawn planning without importing Commander or the full command graph
- Strategy: `copier` for argv helpers, `adapter` for respawn policy

### Slice: SecretRef kernel

- Paths: [`src/secrets/ref-contract.ts`](../../src/secrets/ref-contract.ts), [`src/secrets/resolve.ts`](../../src/secrets/resolve.ts), [`src/secrets/shared.ts`](../../src/secrets/shared.ts), [`src/secrets/json-pointer.ts`](../../src/secrets/json-pointer.ts)
- Central symbols: `secretRefKey`, `resolveDefaultSecretProviderAlias`, `resolveSecretRefValues`, `resolveSecretRefString`
- Why minimal: it already forms a coherent contract plus runtime engine; only the provider config types and safety helpers need adaptation
- Strategy: `adapter`

### Slice: runtime/env/path helper pack

- Paths: [`src/runtime.ts`](../../src/runtime.ts), [`src/infra/env.ts`](../../src/infra/env.ts), [`src/shared/string-coerce.ts`](../../src/shared/string-coerce.ts), [`src/config/paths.ts`](../../src/config/paths.ts)
- Central symbols: `defaultRuntime`, `createNonExitingRuntime`, `writeRuntimeJson`, `normalizeEnv`, `isTruthyEnvValue`, `resolveStateDir`, `resolveConfigPath`
- Why minimal: these helpers stand on their own better than the full config/session runtime, especially for a smaller host process
- Strategy: `copier` with path-policy review

### Slice: library import facade

- Paths: [`src/library.ts`](../../src/library.ts), [`src/index.ts`](../../src/index.ts)
- Central symbols: `runLegacyCliEntry`, `getReplyFromConfig`, `promptYesNo`, `runExec`, `runCommandWithTimeout`
- Why minimal: the pattern is valuable even if the exported functions change, because it keeps import-mode and CLI-mode concerns separate
- Strategy: `copier`

### Slice: session identity and path rules

- Paths: [`src/config/sessions/session-key.ts`](../../src/config/sessions/session-key.ts), [`src/config/sessions/main-session.ts`](../../src/config/sessions/main-session.ts), [`src/config/sessions/paths.ts`](../../src/config/sessions/paths.ts)
- Central symbols: `deriveSessionKey`, `resolveSessionKey`, `resolveMainSessionKey`, `resolveDefaultSessionStorePath`, `resolveStorePath`
- Why minimal: stable session identity is reusable even if the full transcript/store mutation layer is not
- Strategy: `adapter`

## exact search shortcuts

- `rg "tryHandleRootHelpFastPath|tryOutputBareRootHelp|isRootVersionInvocation|buildCliRespawnPlan" openclaw.mjs src/entry.ts src/entry.respawn.ts src/cli`
- `rg "resolveCliArgvInvocation|getCommandPathWithRootOptions|shouldMigrateState" src/cli/argv.ts src/cli/argv-invocation.ts`
- `rg "buildProgram|registerProgramCommands|registerSubCliWithPluginCommands|registerPluginCliCommandsFromValidatedConfig" src/cli/program src/plugins/cli.ts`
- `rg "createConfigIO|readConfigFileSnapshot|writeConfigFile|resolveConfigIncludes|resolveConfigEnvVars|validateConfigObjectWithPlugins" src/config`
- `rg "resolveDefaultSessionStorePath|resolveStorePath|deriveSessionKey|resolveSessionKey|updateSessionStoreEntry" src/config/sessions`
- `rg "secretRefKey|validateExecSecretRefId|resolveSecretRefValues|resolveSecretRefString|SecretRefResolutionError" src/secrets`
- `rg "defaultRuntime|writeRuntimeJson|normalizeEnv|normalizeOptionalString|runExec|runCommandWithTimeout" src/runtime.ts src/infra/env.ts src/shared/string-coerce.ts src/library.ts`
