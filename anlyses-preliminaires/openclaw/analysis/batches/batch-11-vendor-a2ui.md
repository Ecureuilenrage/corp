# Batch 11 - Vendor A2UI

Scope: `153` files. Entirely concentrated in [`vendor/a2ui/`](../../vendor/a2ui), with the actual OpenClaw integration happening outside the subtree through [`scripts/bundle-a2ui.mjs`](../../scripts/bundle-a2ui.mjs), [`apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js`](../../apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js), [`scripts/canvas-a2ui-copy.ts`](../../scripts/canvas-a2ui-copy.ts), and [`src/canvas-host/a2ui.ts`](../../src/canvas-host/a2ui.ts).

## purpose

This batch is not product-owned runtime code in the usual OpenClaw sense. It is a vendored upstream A2UI subtree containing versioned JSON specifications, a Lit renderer package, an Angular renderer package, and evaluation harnesses for the 0.8 and 0.9 specifications.

For extraction work, the most important split is between versioned upstream contracts and host-specific integration glue. The most portable pieces are the versioned schema artifacts under [`vendor/a2ui/specification/0.9/json/`](../../vendor/a2ui/specification/0.9/json) and [`vendor/a2ui/specification/0.8/json/`](../../vendor/a2ui/specification/0.8/json), the Lit message processor in [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts), the Lit renderer surface and component registry in [`vendor/a2ui/renderers/lit/src/0.8/ui/root.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/root.ts), [`vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts), and [`vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts), and the Angular host bridge in [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts), [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts), and [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts).

The least portable parts are the 0.9 evaluation harness under [`vendor/a2ui/specification/0.9/eval/src/`](../../vendor/a2ui/specification/0.9/eval/src), the legacy 0.8 evaluation harness under [`vendor/a2ui/specification/0.8/eval/src/`](../../vendor/a2ui/specification/0.8/eval/src), and any attempt to reuse the subtree without preserving upstream provenance and the 0.8 versus 0.9 version split.

## entrypoints

- [`vendor/a2ui/renderers/lit/src/index.ts`](../../vendor/a2ui/renderers/lit/src/index.ts): package entry for the Lit renderer exports.
- [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts): public 0.8 export surface for data, schemas, events, types, and styles.
- [`vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts): public UI export surface for custom elements and registry helpers.
- [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts): Angular environment-provider entrypoint.
- [`vendor/a2ui/renderers/angular/src/public-api.ts`](../../vendor/a2ui/renderers/angular/src/public-api.ts): Angular package export surface.
- [`vendor/a2ui/specification/0.9/json/server_to_client.json`](../../vendor/a2ui/specification/0.9/json/server_to_client.json): versioned 0.9 server-to-client transport contract.
- [`vendor/a2ui/specification/0.9/json/standard_catalog_definition.json`](../../vendor/a2ui/specification/0.9/json/standard_catalog_definition.json): versioned 0.9 standard catalog contract.
- [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts): 0.9 evaluation CLI.
- [`vendor/a2ui/specification/0.8/eval/src/index.ts`](../../vendor/a2ui/specification/0.8/eval/src/index.ts): legacy 0.8 evaluation CLI.

## key files

- [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts): bundles the Lit-side data processor, guards, schemas, types, and styles into the public 0.8 API.
- [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts): central state engine that turns A2UI messages into surfaces, component trees, and data-model updates.
- [`vendor/a2ui/renderers/lit/src/0.8/ui/root.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/root.ts): main component-tree renderer for standard and custom A2UI nodes.
- [`vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts): surface wrapper that applies logo and theme-derived CSS variables before delegating to `a2ui-root`.
- [`vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts): custom-element registry and type-to-tag mapping helper.
- [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts): Angular provider API for catalog and theme injection.
- [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts): dynamic Angular renderer directive that instantiates catalog components.
- [`vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts): base class for action dispatch and primitive resolution in Angular components.
- [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts): default mapping from A2UI types to Angular component implementations and bindings.
- [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts): Angular wrapper around the Lit message processor plus dispatch stream.
- [`vendor/a2ui/specification/0.9/json/server_to_client.json`](../../vendor/a2ui/specification/0.9/json/server_to_client.json): top-level 0.9 message schema for `createSurface`, `updateComponents`, `updateDataModel`, and `deleteSurface`.
- [`vendor/a2ui/specification/0.9/json/standard_catalog_definition.json`](../../vendor/a2ui/specification/0.9/json/standard_catalog_definition.json): 0.9 component catalog definitions and discriminated component set.
- [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts): main 0.9 evaluation pipeline over generation, schema validation, evaluation, and failure analysis.
- [`vendor/a2ui/specification/0.9/eval/src/validator.ts`](../../vendor/a2ui/specification/0.9/eval/src/validator.ts): AJV-backed validator with additional referential-integrity checks.
- [`vendor/a2ui/specification/0.9/eval/src/evaluator.ts`](../../vendor/a2ui/specification/0.9/eval/src/evaluator.ts): evaluation runner over validated results and severity aggregation.

## data flow

- The A2UI contracts are versioned under [`vendor/a2ui/specification/0.8/json/`](../../vendor/a2ui/specification/0.8/json) and [`vendor/a2ui/specification/0.9/json/`](../../vendor/a2ui/specification/0.9/json). Version 0.8 still drives the shipped Lit and Angular renderers, while 0.9 has a newer schema and evaluation harness.
- The Lit renderer publishes [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts) and [`vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts), which expose `A2uiMessageProcessor`, the schema bundle, the standard custom elements, and the component registry.
- Incoming A2UI messages are consolidated by [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts) into `Surface` state, component trees, and data-model lookups; [`vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts) and [`vendor/a2ui/renderers/lit/src/0.8/ui/root.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/root.ts) then turn that state into concrete custom elements.
- The Angular renderer does not reimplement the data model. [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts) subclasses the Lit-side processor, while [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts) maps A2UI node types into Angular components declared in [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts).
- The 0.9 evaluation stack reads the 0.9 JSON schemas, generates candidate payloads with [`vendor/a2ui/specification/0.9/eval/src/generator.ts`](../../vendor/a2ui/specification/0.9/eval/src/generator.ts), validates them with [`vendor/a2ui/specification/0.9/eval/src/validator.ts`](../../vendor/a2ui/specification/0.9/eval/src/validator.ts), grades them with [`vendor/a2ui/specification/0.9/eval/src/evaluator.ts`](../../vendor/a2ui/specification/0.9/eval/src/evaluator.ts), and summarizes failures in [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts).
- OpenClaw does not serve the vendor subtree directly. [`scripts/bundle-a2ui.mjs`](../../scripts/bundle-a2ui.mjs) builds the vendored Lit renderer and bundles it together with [`apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js`](../../apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js) into `src/canvas-host/a2ui/a2ui.bundle.js`, which [`scripts/canvas-a2ui-copy.ts`](../../scripts/canvas-a2ui-copy.ts) copies to `dist/` and [`src/canvas-host/a2ui.ts`](../../src/canvas-host/a2ui.ts) serves over HTTP.

## external deps

- The Lit renderer depends on `lit`, `@lit/context`, `@lit-labs/signals`, `signal-utils`, and `markdown-it`, as shown in [`vendor/a2ui/renderers/lit/package.json`](../../vendor/a2ui/renderers/lit/package.json).
- The Angular renderer depends on Angular 21 peer dependencies plus `@a2ui/lit`, as shown in [`vendor/a2ui/renderers/angular/package.json`](../../vendor/a2ui/renderers/angular/package.json).
- The 0.9 evaluation harness depends on `genkit`, `@genkit-ai/*`, `ajv`, `js-yaml`, `winston`, `tsx`, and `yargs`, as shown in [`vendor/a2ui/specification/0.9/eval/package.json`](../../vendor/a2ui/specification/0.9/eval/package.json).
- The subtree is Apache-2.0 upstream code from Google A2UI, not OpenClaw-authored runtime.

## flags/env

- The vendor renderers do not expose OpenClaw-specific env flags.
- [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts) accepts `--log-level`, `--results`, `--runs-per-prompt`, `--model`, `--prompt`, `--eval-model`, and `--clean-results`.
- [`vendor/a2ui/specification/0.8/eval/src/index.ts`](../../vendor/a2ui/specification/0.8/eval/src/index.ts) accepts `--results`, `--runs-per-prompt`, `--model`, and `--prompt`.
- OpenClaw's bundle or copy layer around the subtree is controlled outside the vendor tree through [`scripts/bundle-a2ui.mjs`](../../scripts/bundle-a2ui.mjs) and [`scripts/canvas-a2ui-copy.ts`](../../scripts/canvas-a2ui-copy.ts), including `OPENCLAW_A2UI_SKIP_MISSING` and `OPENCLAW_SPARSE_PROFILE`.

## subdomains

### Lit 0.8 data and renderer core

Classification: `runtime central` plus `UI`.

Anchors:

- [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts)
- [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts)
- [`vendor/a2ui/renderers/lit/src/0.8/ui/root.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/root.ts)
- [`vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts)
- [`vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts)

This is the most valuable technical seam in the subtree. It is the actual runtime that turns A2UI messages into renderable surfaces and custom elements.

### Lit 0.8 customization and event bridge

Classification: `adapters`.

Anchors:

- [`vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts)
- [`vendor/a2ui/renderers/lit/src/0.8/events/base.ts`](../../vendor/a2ui/renderers/lit/src/0.8/events/base.ts)
- [`vendor/a2ui/renderers/lit/src/0.8/events/events.ts`](../../vendor/a2ui/renderers/lit/src/0.8/events/events.ts)
- [`vendor/a2ui/renderers/lit/src/0.8/ui/custom-components/index.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/custom-components/index.ts)

This subdomain is what lets hosts map custom component names to their own concrete web components and dispatch typed A2UI client events.

### Angular renderer bridge

Classification: `adapters` plus `UI`.

Anchors:

- [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts)
- [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts)
- [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts)
- [`vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts)
- [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts)

The Angular package is mostly a host adapter layer on top of the Lit-side data processor and 0.8 types. It is useful if the target system is already Angular-first.

### Versioned specification artifacts

Classification: `runtime central`.

Anchors:

- [`vendor/a2ui/specification/0.9/json/server_to_client.json`](../../vendor/a2ui/specification/0.9/json/server_to_client.json)
- [`vendor/a2ui/specification/0.9/json/standard_catalog_definition.json`](../../vendor/a2ui/specification/0.9/json/standard_catalog_definition.json)
- [`vendor/a2ui/specification/0.8/json/server_to_client_with_standard_catalog.json`](../../vendor/a2ui/specification/0.8/json/server_to_client_with_standard_catalog.json)
- [`vendor/a2ui/specification/0.8/json/standard_catalog_definition.json`](../../vendor/a2ui/specification/0.8/json/standard_catalog_definition.json)

These files are the cleanest extraction target in the batch. They are versioned, self-contained, and already designed to travel between hosts.

### 0.9 evaluation harness

Classification: `infra`.

Anchors:

- [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts)
- [`vendor/a2ui/specification/0.9/eval/src/generator.ts`](../../vendor/a2ui/specification/0.9/eval/src/generator.ts)
- [`vendor/a2ui/specification/0.9/eval/src/validator.ts`](../../vendor/a2ui/specification/0.9/eval/src/validator.ts)
- [`vendor/a2ui/specification/0.9/eval/src/evaluator.ts`](../../vendor/a2ui/specification/0.9/eval/src/evaluator.ts)
- [`vendor/a2ui/specification/0.9/eval/src/analysis_flow.ts`](../../vendor/a2ui/specification/0.9/eval/src/analysis_flow.ts)

This is useful as reference infrastructure for prompt or schema evaluation, but it is not a low-friction extraction because it depends on Genkit, external model providers, local results layout, and A2UI-specific prompts.

### 0.8 legacy evaluation harness

Classification: `infra`.

Anchors:

- [`vendor/a2ui/specification/0.8/eval/src/index.ts`](../../vendor/a2ui/specification/0.8/eval/src/index.ts)
- [`vendor/a2ui/specification/0.8/eval/src/flows.ts`](../../vendor/a2ui/specification/0.8/eval/src/flows.ts)
- [`vendor/a2ui/specification/0.8/eval/src/validator.ts`](../../vendor/a2ui/specification/0.8/eval/src/validator.ts)

This is older and less aligned with the 0.9 schema stack. It is more useful as historical context than as a new extraction target.

## feature inventory

### Versioned A2UI JSON schema pack

- Goal: reuse the versioned message and catalog contracts for validation, codegen, or host compatibility checks.
- Open first: [`vendor/a2ui/specification/0.9/json/server_to_client.json`](../../vendor/a2ui/specification/0.9/json/server_to_client.json), [`vendor/a2ui/specification/0.9/json/standard_catalog_definition.json`](../../vendor/a2ui/specification/0.9/json/standard_catalog_definition.json), [`vendor/a2ui/specification/0.8/json/server_to_client_with_standard_catalog.json`](../../vendor/a2ui/specification/0.8/json/server_to_client_with_standard_catalog.json)
- Pivot symbols: `CreateSurfaceMessage`, `UpdateComponentsMessage`, `UpdateDataModelMessage`, `DeleteSurfaceMessage`, `anyComponent`, `Text`, `Image`, `Icon`, `Row`, `Column`, `List`, `Card`, `Tabs`, `Modal`, `Button`, `CheckBox`, `TextField`, `DateTimeInput`, `Slider`
- Strictly required modules: none outside the JSON files themselves
- Dangerous coupling: 0.8 and 0.9 are not interchangeable; OpenClaw currently bundles a 0.8 renderer while the newer evaluator targets 0.9
- Strategy: `copier`

### Lit message processor and surface-state builder

- Goal: consolidate A2UI messages into surfaces, resolved component trees, and data-model reads or writes that a renderer can consume.
- Open first: [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts), [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts)
- Pivot symbols: `Data`, `Schemas`, `A2uiMessageProcessor`, `DEFAULT_SURFACE_ID`, `processMessages`, `getSurfaces`, `clearSurfaces`, `getData`, `setData`, `resolvePath`
- Strictly required modules: [`vendor/a2ui/renderers/lit/src/0.8/data/guards.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/guards.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/types.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/types.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts)
- Dangerous coupling: expects the 0.8 A2UI message shape and component naming, not the 0.9 schema names
- Strategy: `adapter`

### Lit custom-element renderer and custom component registry

- Goal: turn resolved component trees into standard A2UI web components and optionally swap in host-defined custom elements.
- Open first: [`vendor/a2ui/renderers/lit/src/0.8/ui/root.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/root.ts), [`vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts), [`vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts), [`vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts)
- Pivot symbols: `Root`, `Surface`, `ComponentRegistry`, `componentRegistry`, `CustomElementConstructorOf`, `instanceOf`, `registerCustomComponents`
- Strictly required modules: the standard component implementations in [`vendor/a2ui/renderers/lit/src/0.8/ui/`](../../vendor/a2ui/renderers/lit/src/0.8/ui), plus `lit`, `@lit/context`, `@lit-labs/signals`, and `signal-utils`
- Dangerous coupling: host theming, event bridges, and custom-element registration order vary widely between apps
- Strategy: `adapter`

### Angular catalog and host bridge

- Goal: provide Angular-native rendering over the A2UI 0.8 model, catalog bindings, and event dispatch surface.
- Open first: [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts), [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts), [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts)
- Pivot symbols: `provideA2UI`, `DEFAULT_CATALOG`, `Renderer`, `DynamicComponent`, `MessageProcessor`, `DispatchedEvent`
- Strictly required modules: [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts), [`vendor/a2ui/renderers/angular/src/lib/rendering/catalog.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/catalog.ts), [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts)
- Dangerous coupling: this package is not standalone; it imports the Lit 0.8 types and processor package and assumes Angular 21 APIs such as `inputBinding`
- Strategy: `adapter`

### 0.9 schema validator and evaluation harness

- Goal: generate, validate, score, and summarize A2UI payloads against the 0.9 specification.
- Open first: [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts), [`vendor/a2ui/specification/0.9/eval/src/validator.ts`](../../vendor/a2ui/specification/0.9/eval/src/validator.ts), [`vendor/a2ui/specification/0.9/eval/src/evaluator.ts`](../../vendor/a2ui/specification/0.9/eval/src/evaluator.ts)
- Pivot symbols: `Generator`, `Validator`, `Evaluator`, `analysisFlow`, `GeneratedResult`, `ValidatedResult`, `EvaluatedResult`, `IssueSeverity`, `loadSchemas`, `generateSummary`
- Strictly required modules: [`vendor/a2ui/specification/0.9/eval/src/generator.ts`](../../vendor/a2ui/specification/0.9/eval/src/generator.ts), [`vendor/a2ui/specification/0.9/eval/src/models.ts`](../../vendor/a2ui/specification/0.9/eval/src/models.ts), [`vendor/a2ui/specification/0.9/eval/src/prompts.ts`](../../vendor/a2ui/specification/0.9/eval/src/prompts.ts), `genkit`, `ajv`, `yargs`
- Dangerous coupling: ties together model-provider config, prompt corpus, result directories, YAML detail dumps, and A2UI-specific severity logic
- Strategy: `adapter`

### OpenClaw A2UI bundle bridge

- Goal: bundle the vendored Lit renderer into one browser asset and wrap it with OpenClaw's action bridge, theming, and host status UI.
- Open first: [`scripts/bundle-a2ui.mjs`](../../scripts/bundle-a2ui.mjs), [`apps/shared/OpenClawKit/Tools/CanvasA2UI/rolldown.config.mjs`](../../apps/shared/OpenClawKit/Tools/CanvasA2UI/rolldown.config.mjs), [`apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js`](../../apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js), [`src/canvas-host/a2ui.ts`](../../src/canvas-host/a2ui.ts)
- Pivot symbols: `computeHash`, `runPnpm`, `copyA2uiAssets`, `handleA2uiHttpRequest`, `injectCanvasLiveReload`, `OpenClawA2UIHost`, `applyMessages`, `reset`
- Strictly required modules: [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts), [`vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts)
- Dangerous coupling: this bridge is OpenClaw-specific and adds native mobile or desktop action channels, toast state, and bundle-serving logic that do not belong to the upstream vendor package
- Strategy: `adapter`

## symbol map

### Lit 0.8 runtime

- [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts): `Data`, `Schemas`, `createSignalA2uiMessageProcessor`, `A2uiMessageProcessor`
- [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts): `A2uiMessageProcessor`, `DEFAULT_SURFACE_ID`, `processMessages`, `getSurfaces`, `clearSurfaces`, `getData`, `setData`, `resolvePath`
- [`vendor/a2ui/renderers/lit/src/0.8/ui/root.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/root.ts): `Root`
- [`vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/surface.ts): `Surface`
- [`vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts): `ComponentRegistry`, `componentRegistry`
- [`vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts): `TagName`, `CustomElementConstructorOf`, `instanceOf`

### Angular bridge

- [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts): `provideA2UI`
- [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts): `DEFAULT_CATALOG`
- [`vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts): `DynamicComponent`
- [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts): `Renderer`
- [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts): `DispatchedEvent`, `MessageProcessor`

### Specification and evaluation

- [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts): `loadSchemas`, `generateSummary`, `main`
- [`vendor/a2ui/specification/0.9/eval/src/generator.ts`](../../vendor/a2ui/specification/0.9/eval/src/generator.ts): `Generator`
- [`vendor/a2ui/specification/0.9/eval/src/validator.ts`](../../vendor/a2ui/specification/0.9/eval/src/validator.ts): `Validator`
- [`vendor/a2ui/specification/0.9/eval/src/evaluator.ts`](../../vendor/a2ui/specification/0.9/eval/src/evaluator.ts): `Evaluator`
- [`vendor/a2ui/specification/0.9/eval/src/analysis_flow.ts`](../../vendor/a2ui/specification/0.9/eval/src/analysis_flow.ts): `analysisFlow`
- [`vendor/a2ui/specification/0.9/eval/src/types.ts`](../../vendor/a2ui/specification/0.9/eval/src/types.ts): `GeneratedResult`, `ValidatedResult`, `EvaluatedResult`, `IssueSeverity`

## dependency map

### Internal dependencies that are truly central

- The Lit renderer core depends on [`vendor/a2ui/renderers/lit/src/0.8/data/guards.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/guards.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/types.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/types.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts), and the concrete components under [`vendor/a2ui/renderers/lit/src/0.8/ui/`](../../vendor/a2ui/renderers/lit/src/0.8/ui).
- The Angular renderer depends on the Lit package itself through `@a2ui/lit/0.8`; it is an adapter layer, not an independent implementation.
- The 0.9 evaluation harness depends on the 0.9 JSON schemas, prompt files, model lists, and provider-facing Genkit flows.

### External dependencies

- `lit`, `@lit/context`, `@lit-labs/signals`, `signal-utils`, `markdown-it`
- Angular 21 packages
- `genkit`, `@genkit-ai/*`, `ajv`, `js-yaml`, `yargs`, `tsx`

### Runtime and config dependencies

- The Lit renderer package copies 0.8 specification JSON into its own `src/0.8/schemas/` during build, as shown in [`vendor/a2ui/renderers/lit/package.json`](../../vendor/a2ui/renderers/lit/package.json).
- The evaluation harnesses expect API credentials and provider configuration for the target LLMs, but those settings live outside the vendored source.
- OpenClaw's actual runtime integration depends on the bundle and serve layer in [`scripts/bundle-a2ui.mjs`](../../scripts/bundle-a2ui.mjs), [`scripts/canvas-a2ui-copy.ts`](../../scripts/canvas-a2ui-copy.ts), [`apps/shared/OpenClawKit/Tools/CanvasA2UI/rolldown.config.mjs`](../../apps/shared/OpenClawKit/Tools/CanvasA2UI/rolldown.config.mjs), and [`src/canvas-host/a2ui.ts`](../../src/canvas-host/a2ui.ts).

### Glue that can be rewritten to shrink coupling

- Replace OpenClaw's `OpenClawA2UIHost` in [`apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js`](../../apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js) with a host-local bridge if you only need the upstream Lit renderer.
- Replace the vendor build-and-copy flow in [`scripts/bundle-a2ui.mjs`](../../scripts/bundle-a2ui.mjs) and [`scripts/canvas-a2ui-copy.ts`](../../scripts/canvas-a2ui-copy.ts) with your own asset pipeline.
- Replace the Angular default catalog in [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts) if your host wants a different component set or bindings.
- Replace the 0.9 evaluation prompt corpus and model registry instead of copying the whole evaluator as-is.

## extraction recipes

### Recipe: versioned schema vendor pack

- Carry: [`vendor/a2ui/specification/0.9/json/server_to_client.json`](../../vendor/a2ui/specification/0.9/json/server_to_client.json), [`vendor/a2ui/specification/0.9/json/standard_catalog_definition.json`](../../vendor/a2ui/specification/0.9/json/standard_catalog_definition.json), and optionally the 0.8 JSON set if you must support the legacy renderer
- Keep together: the schema version, the catalog definition, and any codegen or validator that references that exact `$id`
- Replace with shims: none, other than version pinning in your own build or validation tooling
- Result: the cleanest possible reuse path for A2UI compatibility without inheriting any renderer or host glue

### Recipe: Lit message processor core

- Carry: [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts), [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts), [`vendor/a2ui/renderers/lit/src/0.8/data/guards.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/guards.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/types.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/types.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts)
- Keep together: `A2uiMessageProcessor`, the guards, and the exact 0.8 types
- Replace with shims: your own renderer layer if you do not want Lit custom elements
- Result: a compact state engine for A2UI surfaces without dragging in OpenClaw's bundle host

### Recipe: full Lit renderer via upstream pin

- Carry: the entire [`vendor/a2ui/renderers/lit/`](../../vendor/a2ui/renderers/lit) package, preferably by pinning or vendoring the upstream package version rather than copying from OpenClaw's generated bundle
- Keep together: `core.ts`, `ui/ui.ts`, `ui/root.ts`, `ui/surface.ts`, `component-registry.ts`, and the standard UI components
- Replace with shims: host theming and action bridges
- Result: the safest way to reuse the renderer while preserving provenance and upgradeability

### Recipe: Angular A2UI host adapter

- Carry: [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts), [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts), [`vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts), [`vendor/a2ui/renderers/angular/src/lib/catalog/default.ts`](../../vendor/a2ui/renderers/angular/src/lib/catalog/default.ts), [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts)
- Keep together: `provideA2UI`, `Renderer`, `DynamicComponent`, `MessageProcessor`, and the chosen catalog
- Replace with shims: the catalog mapping and any host-specific theme or event completion path
- Result: an Angular-native A2UI host that still reuses the upstream A2UI data layer

## do not copy blindly

- Do not copy the whole [`vendor/a2ui/`](../../vendor/a2ui) subtree into another project without tracking provenance and version pinning. This batch is upstream code with its own release cadence and license obligations.
- Do not mix the 0.8 renderer packages with the 0.9 schemas casually. The shipped Lit and Angular renderers are 0.8-oriented, while the newer evaluator targets 0.9.
- Do not treat [`apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js`](../../apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js) as part of upstream A2UI. It is OpenClaw-specific glue that adds custom theming, status UI, native action bridges, and bundle assumptions.
- Do not assume the Angular package stands alone. [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts) subclasses the Lit data processor, and many Angular files import `@a2ui/lit/0.8`.
- Do not copy the 0.9 evaluation harness unless you also want Genkit, external model-provider setup, YAML result artifacts, and the bundled prompt corpus.

## minimal reusable slices

### Slice: 0.9 schema artifacts

- Copy status: `copiable tel quel`
- Minimal files: [`vendor/a2ui/specification/0.9/json/server_to_client.json`](../../vendor/a2ui/specification/0.9/json/server_to_client.json), [`vendor/a2ui/specification/0.9/json/standard_catalog_definition.json`](../../vendor/a2ui/specification/0.9/json/standard_catalog_definition.json), [`vendor/a2ui/specification/0.9/json/common_types.json`](../../vendor/a2ui/specification/0.9/json/common_types.json)
- Why viable: these are versioned contracts with no host runtime baggage

### Slice: Lit message processor core

- Copy status: `copiable avec adaptation`
- Minimal files: [`vendor/a2ui/renderers/lit/src/0.8/core.ts`](../../vendor/a2ui/renderers/lit/src/0.8/core.ts), [`vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts), [`vendor/a2ui/renderers/lit/src/0.8/data/guards.ts`](../../vendor/a2ui/renderers/lit/src/0.8/data/guards.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/types.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/types.ts), [`vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts`](../../vendor/a2ui/renderers/lit/src/0.8/types/primitives.ts)
- Why viable: this is the smallest runtime slice that still understands A2UI messages and surface trees

### Slice: Lit custom registry

- Copy status: `copiable avec adaptation`
- Minimal files: [`vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/component-registry.ts), [`vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts`](../../vendor/a2ui/renderers/lit/src/0.8/ui/ui.ts)
- Why viable: it is a compact host-side extension seam for custom web components

### Slice: Angular provider and renderer bridge

- Copy status: `copiable avec adaptation`
- Minimal files: [`vendor/a2ui/renderers/angular/src/lib/config.ts`](../../vendor/a2ui/renderers/angular/src/lib/config.ts), [`vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/renderer.ts), [`vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts`](../../vendor/a2ui/renderers/angular/src/lib/rendering/dynamic-component.ts), [`vendor/a2ui/renderers/angular/src/lib/data/processor.ts`](../../vendor/a2ui/renderers/angular/src/lib/data/processor.ts)
- Why viable: this is the minimum Angular-facing slice before the default catalog and concrete components enter the picture

### Slice: 0.9 evaluation harness

- Copy status: `a reecrire partiellement`
- Minimal files: [`vendor/a2ui/specification/0.9/eval/src/index.ts`](../../vendor/a2ui/specification/0.9/eval/src/index.ts), [`vendor/a2ui/specification/0.9/eval/src/validator.ts`](../../vendor/a2ui/specification/0.9/eval/src/validator.ts), [`vendor/a2ui/specification/0.9/eval/src/evaluator.ts`](../../vendor/a2ui/specification/0.9/eval/src/evaluator.ts), [`vendor/a2ui/specification/0.9/eval/src/types.ts`](../../vendor/a2ui/specification/0.9/eval/src/types.ts)
- Why viable: the pattern is useful, but the provider stack and prompt corpus are too specific to copy verbatim

## exact search shortcuts

- `rg -n "A2uiMessageProcessor|DEFAULT_SURFACE_ID|processMessages|getSurfaces|resolvePath" vendor/a2ui/renderers/lit/src/0.8/data/model-processor.ts vendor/a2ui/renderers/lit/src/0.8/core.ts`
- `rg -n "class Root|class Surface|ComponentRegistry|componentRegistry|instanceOf|registerCustomComponents" vendor/a2ui/renderers/lit/src/0.8/ui`
- `rg -n "provideA2UI|DEFAULT_CATALOG|class Renderer|class DynamicComponent|class MessageProcessor" vendor/a2ui/renderers/angular/src/lib`
- `rg -n "\"CreateSurfaceMessage\"|\"UpdateComponentsMessage\"|\"UpdateDataModelMessage\"|\"DeleteSurfaceMessage\"|\"anyComponent\"" vendor/a2ui/specification/0.9/json`
- `rg -n "class Generator|class Validator|class Evaluator|analysisFlow|GeneratedResult|EvaluatedResult|IssueSeverity" vendor/a2ui/specification/0.9/eval/src`
- `rg -n "computeHash|runPnpm|copyA2uiAssets|OpenClawA2UIHost|handleA2uiHttpRequest|injectCanvasLiveReload" scripts/bundle-a2ui.mjs scripts/canvas-a2ui-copy.ts apps/shared/OpenClawKit/Tools/CanvasA2UI/bootstrap.js src/canvas-host/a2ui.ts`
