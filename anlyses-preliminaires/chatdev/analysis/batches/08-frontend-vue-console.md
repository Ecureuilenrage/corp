# 08-frontend-vue-console - Frontend Vue Workbench

_Primary coverage_: 46 fichiers, 24150 lignes approx. dans ce batch.

## purpose
Porter la console no-code Vue/Vite qui edite les workflows YAML, pilote les formulaires schemas, lance les runs sync/WebSocket et expose une vue batch.

## subdomains
- frontend Vue / bootstrap: `frontend/src/main.js`, `frontend/src/App.vue`, `frontend/src/router/index.js`, `frontend/src/i18n.js`.
- workbench d'edition workflow: `frontend/src/pages/WorkflowWorkbench.vue`, `frontend/src/pages/WorkflowView.vue`, `frontend/src/pages/WorkflowList.vue`, `frontend/src/components/WorkflowNode.vue`, `frontend/src/components/WorkflowEdge.vue`, `frontend/src/components/StartNode.vue`.
- formulaires pilotes par schema: `frontend/src/components/FormGenerator.vue`, `frontend/src/components/DynamicFormField.vue`, `frontend/src/components/InlineConfigRenderer.vue`, `frontend/src/utils/formUtils.js`.
- console de lancement / execution live: `frontend/src/pages/LaunchView.vue`, `frontend/src/components/CollapsibleMessage.vue`, `frontend/src/components/SettingsModal.vue`.
- vue batch / session multiple: `frontend/src/pages/BatchRunView.vue`.
- client API / serialisation YAML / config UI: `frontend/src/utils/apiFunctions.js`, `frontend/src/utils/yamlFunctions.js`, `frontend/src/utils/configStore.js`.
- aides UI / sprites / tooltips: `frontend/src/components/RichTooltip.vue`, `frontend/src/utils/helpContent.js`, `frontend/src/utils/colorUtils.js`, `frontend/src/utils/spriteFetcher.js`.
- backend/API touches par couplage: `server/config_schema_router.py`, `server/routes/workflows.py`, `server/routes/execute_sync.py`, `server/routes/websocket.py`, `server/routes/vuegraphs.py`, `server/routes/artifacts.py`.
- YAML declaratif / docs executables: `frontend/public/design_0.4.0.yaml`, `frontend/public/tutorial-en.md`, `frontend/public/tutorial-zh.md`.

## entrypoints
- `frontend/src/main.js` - `createApp(App).use(router).use(i18n)` - bootstrap principal.
- `frontend/src/router/index.js` - `createRouter` - routes `workflows`, `launch`, `batch-run`, `tutorial`.
- `frontend/src/pages/WorkflowWorkbench.vue` - compose liste des workflows + `WorkflowView`.
- `frontend/src/pages/WorkflowView.vue` - coeur de l'editeur YAML/Vue Flow.
- `frontend/src/pages/LaunchView.vue` - console d'execution live avec chat, graph, uploads, artefacts.
- `frontend/src/pages/BatchRunView.vue` - console batch avec dashboard et logs.

## key files
- `frontend/src/pages/WorkflowView.vue` - `initializeWorkflow`, `loadAndSyncVueFlowGraph`, `updateNodesAndEdgesFromYaml`, `handleFormGeneratorSubmit`, `openNodeEditor`, `openEdgeEditor`, `onConnect`, `saveVueFlowGraph`.
- `frontend/src/components/FormGenerator.vue` - `generateForm`, `submitForm`, `deleteEntry`, `openChildModal`, `openConditionalChildModal`, `validateModalFormEnhanced`.
- `frontend/src/components/DynamicFormField.vue` - rend les champs polymorphes et les boutons de navigation enfant.
- `frontend/src/pages/LaunchView.vue` - `establishWebSocketConnection`, `launchWorkflow`, `processMessage`, `sendHumanInput`, `downloadArtifact`.
- `frontend/src/pages/BatchRunView.vue` - `establishWebSocketConnection`, `launchBatchWorkflow`, `processBatchMessage`, `downloadLogs`.
- `frontend/src/utils/apiFunctions.js` - tous les helpers backend reels.
- `frontend/src/utils/formUtils.js` - detection des champs listes, `childRoutes`, routes conditionnelles.
- `frontend/src/utils/yamlFunctions.js` - `convertFormDataToYAML`.

## feature inventory
- `frontend.workflow_editor_console`: frontend Vue / workbench. Fichiers `frontend/src/pages/WorkflowWorkbench.vue`, `frontend/src/pages/WorkflowView.vue`, `frontend/src/pages/WorkflowList.vue`, `frontend/src/components/WorkflowNode.vue`, `frontend/src/components/WorkflowEdge.vue`, `frontend/src/components/StartNode.vue`. Symboles centraux `handleToggleSidebar`, `handleSelect`, `initializeWorkflow`, `loadAndSyncVueFlowGraph`, `generateNodesAndEdges`, `openNodeEditor`, `openEdgeEditor`, `onConnect`, `saveVueFlowGraph`. Statut reuse: copiable avec adaptation.
- `frontend.schema_driven_forms`: formulaires pilotes par schema. Fichiers `frontend/src/components/FormGenerator.vue`, `frontend/src/components/DynamicFormField.vue`, `frontend/src/components/InlineConfigRenderer.vue`, `frontend/src/utils/formUtils.js`. Symboles centraux `generateForm`, `submitForm`, `openChildModal`, `openConditionalChildModal`, `validateModalFormEnhanced`, `getSchemaFields`, `getDisplayFields`, `determineRouteControllerField`, `getActiveChildRoute`. Statut reuse: copiable avec adaptation.
- `frontend.launch_execution_console`: console de lancement live. Fichiers `frontend/src/pages/LaunchView.vue`, `frontend/src/utils/apiFunctions.js`, `frontend/src/components/CollapsibleMessage.vue`, `frontend/src/components/SettingsModal.vue`. Symboles centraux `establishWebSocketConnection`, `launchWorkflow`, `processMessage`, `sendHumanInput`, `downloadArtifact`, `fetchLogsZip`, `postFile`, `getAttachment`. Statut reuse: copiable avec adaptation forte.
- `frontend.batch_run_console`: console batch. Fichiers `frontend/src/pages/BatchRunView.vue`, `frontend/src/utils/apiFunctions.js`. Symboles centraux `launchBatchWorkflow`, `processBatchMessage`, `postBatchWorkflow`, `downloadLogs`. Statut reuse: copiable avec adaptation.
- `frontend.yaml_form_serialization`: serialization / save. Fichiers `frontend/src/utils/yamlFunctions.js`, `frontend/src/components/FormGenerator.vue`, `frontend/src/pages/WorkflowView.vue`. Symboles centraux `convertFormDataToYAML`, `buildPartialYamlPayload`, `saveWorkflowYaml`, `persistYamlSnapshot`. Statut reuse: copiable avec adaptation.
- `frontend.api_client_surface`: client API. Fichiers `frontend/src/utils/apiFunctions.js`. Symboles centraux `postYaml`, `updateYaml`, `postYamlNameChange`, `postYamlCopy`, `fetchWorkflowsWithDesc`, `fetchWorkflowYAML`, `fetchVueGraph`, `postVuegraphs`, `fetchConfigSchema`, `postBatchWorkflow`, `postFile`, `getAttachment`, `fetchLogsZip`. Statut reuse: copiable avec adaptation.

## data flow
1. `frontend/src/router/index.js` charge la route, puis `WorkflowWorkbench.vue` selectionne un workflow et affiche `WorkflowView.vue`.
2. `WorkflowView.vue` charge le YAML via `fetchWorkflowYAML`, charge le `vuegraph` via `fetchVueGraph`, puis synchronise les deux representations.
3. Quand l'utilisateur ouvre un editeur, `FormGenerator.vue` appelle `fetchConfigSchema` avec des breadcrumbs backend, construit une stack de modales et renvoie un payload YAML partiel.
4. `WorkflowView.vue::handleFormGeneratorSubmit` reintegre ce payload dans le YAML global, resynchronise les noeuds/edges Vue Flow et persiste YAML + vuegraph.
5. `LaunchView.vue` et `BatchRunView.vue` appellent les endpoints backend via `apiFunctions.js`, puis traitent les messages WebSocket et SSE pour logs, prompts humains, artefacts et progression.

## symbol map
- `frontend/src/main.js`: `createApp(...).use(router).use(i18n).mount(...)`.
- `frontend/src/router/index.js`: `routes`, `router`.
- `frontend/src/pages/WorkflowWorkbench.vue`: `handleToggleSidebar`, `handleSelect`, `handleRefreshWorkflows`.
- `frontend/src/pages/WorkflowList.vue`: `loadWorkflows`, `filteredFiles`, `goToWorkflowView`, `openFormGenerator`, `handleFormGeneratorSubmit`.
- `frontend/src/pages/WorkflowView.vue`: `initializeWorkflow`, `saveVueFlowGraph`, `loadAndSyncVueFlowGraph`, `loadYamlFile`, `updateNodesAndEdgesFromYaml`, `generateNodesAndEdges`, `syncVueNodesAndEdgesData`, `buildYamlWithoutNode`, `buildYamlWithoutEdge`, `openDynamicFormGenerator`, `handleFormGeneratorSubmit`, `openNodeEditor`, `openEdgeEditor`, `openCreateNodeModal`, `openCreateEdgeModal`, `openManageVarsModal`, `openManageMemoriesModal`, `openConfigureGraphModal`, `onNodeClick`, `onEdgeClick`, `onNodeDragStop`, `onConnect`, `goToLaunch`, `handleRenameSubmit`, `handleCopySubmit`.
- `frontend/src/components/FormGenerator.vue`: `generateForm`, `openChildModal`, `openConditionalChildModal`, `toggleAdvancedFields`, `saveWorkflowYaml`, `deleteEntry`, `copyNode`, `submitForm`, `handleEnumChange`, `openVarModal`, `confirmVar`, `openListItemModal`, `confirmListItem`, `validateModalFormEnhanced`.
- `frontend/src/components/DynamicFormField.vue`: composant de rendu dynamique de champ.
- `frontend/src/components/InlineConfigRenderer.vue`: recursivite inline sur sous-configs.
- `frontend/src/pages/LaunchView.vue`: `loadWorkflows`, `handleYAMLSelection`, `establishWebSocketConnection`, `launchWorkflow`, `processMessage`, `sendHumanInput`, `cancelWorkflow`, `downloadLogs`, `downloadArtifact`, `loadVueFlowGraph`, `switchToGraph`.
- `frontend/src/pages/BatchRunView.vue`: `loadWorkflows`, `handleYAMLSelection`, `establishWebSocketConnection`, `launchBatchWorkflow`, `processBatchMessage`, `cancelBatchWorkflow`, `downloadLogs`.
- `frontend/src/utils/apiFunctions.js`: `postYaml`, `updateYaml`, `postYamlNameChange`, `postYamlCopy`, `fetchWorkflowsWithDesc`, `fetchWorkflowYAML`, `fetchYaml`, `fetchVueGraph`, `postVuegraphs`, `fetchConfigSchema`, `fetchLogsZip`, `getAttachment`, `postBatchWorkflow`, `postFile`.
- `frontend/src/utils/formUtils.js`: `isListField`, `hasChildRoutes`, `isInlineConfigField`, `getSchemaFields`, `getDisplayFields`, `determineRouteControllerField`, `getActiveChildRoute`, `canOpenConditionalChildModal`, `getConditionalChildKeyValue`, `isFieldVisible`, `childNodeButtonLabel`, `conditionalChildButtonLabel`.
- `frontend/src/utils/yamlFunctions.js`: `convertFormDataToYAML`.
- `frontend/src/utils/configStore.js`: `configStore`.
- `frontend/src/utils/helpContent.js`: `helpContent`, `getHelpContent`, `getNodeHelp`, `getEdgeHelp`.
- `frontend/src/utils/colorUtils.js`: `getNodeStyles`.
- `frontend/src/utils/spriteFetcher.js`: `spriteFetcher`.

## dependency map
- hard blocker - backend schema contract: `server/config_schema_router.py` + `utils/schema_exporter.py`. Sans cette API, `FormGenerator.vue` ne peut pas construire les modales.
- hard blocker - workflow CRUD/API surface: `server/routes/workflows.py`, `server/routes/vuegraphs.py`, `server/routes/execute_sync.py`, `server/routes/websocket.py`, `server/routes/artifacts.py`, `server/routes/batch.py`, `server/routes/uploads.py`.
- hard blocker - vueflow layout contract: `@vue-flow/core` et le format `vuegraph` persiste par le backend.
- medium blocker - YAML shape contract: `yamlFunctions.js`, `WorkflowView.vue` et `FormGenerator.vue` supposent une structure YAML ChatDev precise (`graph`, `nodes`, `edges`, `memory`, `vars`).
- medium blocker - WebSocket message protocol: `LaunchView.vue` et `BatchRunView.vue` supposent des messages serveur specifiques (`workflow_started`, `workflow_completed`, `artifact_created`, prompts humains, logs).
- inbound adapters utiles a lire avant extraction: `server/config_schema_router.py`, `server/routes/workflows.py`, `server/routes/vuegraphs.py`, `server/routes/execute_sync.py`, `server/routes/websocket.py`, `frontend/public/design_0.4.0.yaml`.

## external deps
- `vue`, `vue-router`, `vue-i18n`.
- `@vue-flow/core`, `@vue-flow/background`, `@vue-flow/controls`, `@vue-flow/minimap`.
- `js-yaml`, `markdown-it`.

## flags/env
- `VITE_API_BASE_URL` configure le backend cible.
- `configStore` persiste des reglages UI locaux comme `ENABLE_HELP_TOOLTIPS`.

## reusable ideas
- `FormGenerator.vue` + `formUtils.js` + backend schema API est la meilleure brique a extraire si l'objectif est un editeur no-code schema-driven.
- `WorkflowView.vue` montre une vraie technique de double source of truth YAML + graph visuel, mais c'est une extraction plus lourde.
- `LaunchView.vue` et `BatchRunView.vue` valent comme reference de protocole plus que comme composants facilement transplantables.

## extraction recipes
1. Extraire seulement les formulaires schemas.
   Fichiers a prendre d'abord: `frontend/src/components/FormGenerator.vue`, `frontend/src/components/DynamicFormField.vue`, `frontend/src/components/InlineConfigRenderer.vue`, `frontend/src/utils/formUtils.js`.
   Dependances minimales: API `/schema`, `helpContent`, styles.
   Strategie: copier avec adaptation.

2. Extraire l'editeur workflow minimal.
   Fichiers a prendre d'abord: `frontend/src/pages/WorkflowWorkbench.vue`, `frontend/src/pages/WorkflowView.vue`, `frontend/src/pages/WorkflowList.vue`, `frontend/src/components/WorkflowNode.vue`, `frontend/src/components/WorkflowEdge.vue`, `frontend/src/utils/apiFunctions.js`.
   Dependances minimales: backend CRUD YAML/vuegraph + schema API.
   Strategie: copier avec adaptation forte.

3. Extraire la console de lancement live.
   Fichiers a prendre d'abord: `frontend/src/pages/LaunchView.vue`, `frontend/src/components/CollapsibleMessage.vue`, `frontend/src/utils/apiFunctions.js`.
   Dependances minimales: WebSocket backend et routes d'artefacts/uploads.
   Strategie: copier avec adaptation forte.

4. Extraire la vue batch.
   Fichiers a prendre d'abord: `frontend/src/pages/BatchRunView.vue`, `frontend/src/utils/apiFunctions.js`.
   Dependances minimales: route batch + protocole WebSocket.
   Strategie: copier avec adaptation.

5. Extraire la simple serialization YAML.
   Fichiers a prendre d'abord: `frontend/src/utils/yamlFunctions.js`.
   Dependances minimales: `js-yaml`.
   Strategie: copier presque tel quel si la forme YAML reste proche.

## do not copy blindly
- `WorkflowView.vue` est tres couple au format de YAML ChatDev, au format `vuegraph` stocke cote serveur et au schema API. Le copier sans le backend correspondant produit vite un editeur incoherent.
- `FormGenerator.vue` est plus reutilisable, mais il suppose que les `fields` backend contiennent `childRoutes`, `advance`, `enum_options`, `childNode` et d'autres conventions issues de `schema_exporter.py`.
- `LaunchView.vue` et `BatchRunView.vue` contiennent beaucoup de logique de protocole implicite et d'etat UI. A copier seulement si vous gardez le backend compatible.
- `apiFunctions.js` a plusieurs helpers tres concrets mais les chemins d'API sont hardcodes et la plupart attendent exactement les reponses du backend ChatDev.

## minimal reusable slices
- slice `schema-form-ui`: `frontend/src/components/FormGenerator.vue`, `frontend/src/components/DynamicFormField.vue`, `frontend/src/components/InlineConfigRenderer.vue`, `frontend/src/utils/formUtils.js`. Copiable avec adaptation.
- slice `yaml-serialization`: `frontend/src/utils/yamlFunctions.js`. Copiable presque tel quel.
- slice `api-client-surface`: `frontend/src/utils/apiFunctions.js`. Copiable avec adaptation.
- slice `workflow-list-shell`: `frontend/src/pages/WorkflowWorkbench.vue`, `frontend/src/pages/WorkflowList.vue`. Copiable avec adaptation.
- slice `launch-console`: `frontend/src/pages/LaunchView.vue`. Copiable avec adaptation forte.
- slice `batch-console`: `frontend/src/pages/BatchRunView.vue`. Copiable avec adaptation.

## exact search shortcuts
- `rg -n "initializeWorkflow|loadAndSyncVueFlowGraph|handleFormGeneratorSubmit|openNodeEditor|openEdgeEditor|onConnect|saveVueFlowGraph" frontend/src/pages/WorkflowView.vue`
- `rg -n "generateForm|submitForm|deleteEntry|openChildModal|openConditionalChildModal|validateModalFormEnhanced" frontend/src/components/FormGenerator.vue`
- `rg -n "isListField|hasChildRoutes|getSchemaFields|getDisplayFields|determineRouteControllerField|getActiveChildRoute" frontend/src/utils/formUtils.js`
- `rg -n "postYaml|updateYaml|fetchConfigSchema|postBatchWorkflow|postFile|getAttachment|fetchLogsZip" frontend/src/utils/apiFunctions.js`
- `rg -n "convertFormDataToYAML" frontend/src/utils/yamlFunctions.js`
- `rg -n "establishWebSocketConnection|launchWorkflow|processMessage|sendHumanInput|downloadArtifact|cancelWorkflow" frontend/src/pages/LaunchView.vue`
- `rg -n "launchBatchWorkflow|processBatchMessage|downloadLogs|cancelBatchWorkflow" frontend/src/pages/BatchRunView.vue`
- `rg -n "workflow-sidebar-state|handleToggleSidebar|handleSelect" frontend/src/pages/WorkflowWorkbench.vue`
- `rg -n "WorkflowNode|WorkflowEdge|StartNode|getNodeStyles|getNodeHelp|getEdgeHelp" frontend/src/components frontend/src/utils`

## copy risk
- copiable tel quel: `frontend/src/utils/yamlFunctions.js` presque entier.
- copiable avec adaptation: `frontend/src/utils/apiFunctions.js`, `frontend/src/utils/formUtils.js`, `frontend/src/components/FormGenerator.vue`, `frontend/src/components/DynamicFormField.vue`, `frontend/src/components/InlineConfigRenderer.vue`.
- a reecrire ou a recabler fortement avant copie: `frontend/src/pages/WorkflowView.vue`, `frontend/src/pages/LaunchView.vue`, `frontend/src/pages/BatchRunView.vue`.

## primary file slice
- `frontend/src/main.js`
- `frontend/src/router/index.js`
- `frontend/src/i18n.js`
- `frontend/src/pages/WorkflowWorkbench.vue`
- `frontend/src/pages/WorkflowView.vue`
- `frontend/src/pages/WorkflowList.vue`
- `frontend/src/pages/LaunchView.vue`
- `frontend/src/pages/BatchRunView.vue`
- `frontend/src/components/FormGenerator.vue`
- `frontend/src/components/DynamicFormField.vue`
- `frontend/src/components/InlineConfigRenderer.vue`
- `frontend/src/components/WorkflowNode.vue`
- `frontend/src/components/WorkflowEdge.vue`
- `frontend/src/components/StartNode.vue`
- `frontend/src/components/CollapsibleMessage.vue`
- `frontend/src/components/SettingsModal.vue`
- `frontend/src/components/RichTooltip.vue`
- `frontend/src/utils/apiFunctions.js`
- `frontend/src/utils/formUtils.js`
- `frontend/src/utils/yamlFunctions.js`
- `frontend/src/utils/configStore.js`
- `frontend/src/utils/helpContent.js`
- `frontend/src/utils/colorUtils.js`
- `frontend/src/utils/spriteFetcher.js`
