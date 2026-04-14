---
batch_id: B04
title: Agent orchestration
paths:
  - src/Task.ts
  - src/tasks/**
  - src/coordinator/**
  - src/tools/AgentTool/**
  - src/tools/SendMessageTool/**
  - src/tools/TeamCreateTool/**
  - src/tools/TeamDeleteTool/**
  - src/tools/TaskCreateTool/**
  - src/tools/TaskGetTool/**
  - src/tools/TaskListTool/**
  - src/tools/TaskUpdateTool/**
  - src/tools/TaskStopTool/**
  - src/tools/TaskOutputTool/**
  - src/tools/EnterPlanModeTool/**
  - src/tools/ExitPlanModeTool/**
  - src/tools/EnterWorktreeTool/**
  - src/tools/ExitWorktreeTool/**
  - src/tools/shared/spawnMultiAgent.ts
  - src/utils/tasks.ts
  - src/utils/teammateMailbox.ts
  - src/utils/task/**
  - src/utils/swarm/**
  - src/utils/worktree.ts
  - src/hooks/useSwarm*.ts
  - src/hooks/useTaskListWatcher.ts
  - src/hooks/useTasksV2.ts
  - src/components/CoordinatorAgentStatus.tsx
  - src/components/TaskListV2.tsx
  - src/components/WorktreeExitDialog.tsx
  - src/components/messages/PlanApprovalMessage.tsx
  - src/components/messages/TaskAssignmentMessage.tsx
  - src/components/tasks/**
priority: haute
status: generated
keywords:
  - AgentTool
  - TeamCreateTool
  - TaskList
  - SendMessageTool
  - swarm
  - plan-mode
  - worktree
---

# B04 - Agent orchestration

## Resume
- Couverture: 153 fichiers / 32556 lignes.
- Hubs dominants via manifest: `src/tools/AgentTool/AgentTool.tsx` (1398 lignes), `src/utils/swarm/inProcessRunner.ts` (1552), `src/tools/AgentTool/runAgent.ts` (973), `src/tools/SendMessageTool/SendMessageTool.ts` (917), `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx` (856), `src/utils/swarm/teamHelpers.ts` (683), `src/tasks/LocalAgentTask/LocalAgentTask.tsx` (683).
- Le domaine B04 combine 6 couches imbriquees: definitions d'agents, runtime d'agents, task runtime UI, task list persistante, protocole mailbox/permissions, plan/worktree controls.
- Risque majeur d'extraction: le mot `task` designe deux modeles differents:
  - runtime task state en memoire dans `AppState.tasks` (`src/Task.ts`, `src/utils/task/framework.ts`, `src/tasks/**`)
  - task list persistante sur disque pour coordonner une equipe (`src/utils/tasks.ts`, `src/tools/Task*Tool/**`, `src/hooks/useTasksV2.ts`)
- Regle de lecture utile: `AgentTool` choisit d'abord le mode de spawn, puis seulement le type d'agent:
  - `team_name` + `name` => teammate/team spawn
  - sinon => sous-agent local, fork, remote, background ou foreground

## purpose
Sous-agents, teams, task list persistante, message routing inter-agents, mode coordinateur, plan mode et isolation worktree.

## subdomains
- `agent definitions`
  - `src/tools/AgentTool/loadAgentsDir.ts`
  - `src/tools/AgentTool/forkSubagent.ts`
  - `src/tools/AgentTool/agentToolUtils.ts`
- `agent runtime`
  - `src/tools/AgentTool/AgentTool.tsx`
  - `src/tools/AgentTool/runAgent.ts`
  - `src/tasks/LocalAgentTask/LocalAgentTask.tsx`
  - `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx`
- `tasks lifecycle`
  - runtime UI: `src/Task.ts`, `src/utils/task/framework.ts`, `src/tasks/stopTask.ts`, `src/tools/TaskStopTool/TaskStopTool.ts`, `src/tools/TaskOutputTool/TaskOutputTool.tsx`
  - persistent list: `src/utils/tasks.ts`, `src/tools/TaskCreateTool/TaskCreateTool.ts`, `src/tools/TaskGetTool/TaskGetTool.ts`, `src/tools/TaskListTool/TaskListTool.ts`, `src/tools/TaskUpdateTool/TaskUpdateTool.ts`
- `team orchestration`
  - `src/tools/TeamCreateTool/TeamCreateTool.ts`
  - `src/tools/TeamDeleteTool/TeamDeleteTool.ts`
  - `src/utils/swarm/teamHelpers.ts`
  - `src/coordinator/coordinatorMode.ts`
- `backend abstraction`
  - `src/utils/swarm/backends/types.ts`
  - `src/utils/swarm/backends/registry.ts`
  - `src/utils/swarm/backends/InProcessBackend.ts`
  - `src/tools/shared/spawnMultiAgent.ts`
  - `src/utils/swarm/spawnInProcess.ts`
  - `src/utils/swarm/inProcessRunner.ts`
- `plan mode guardrails`
  - `src/tools/EnterPlanModeTool/EnterPlanModeTool.ts`
  - `src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts`
  - `src/components/permissions/EnterPlanModePermissionRequest/EnterPlanModePermissionRequest.tsx`
  - `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`
  - `src/components/messages/PlanApprovalMessage.tsx`
- `worktree isolation`
  - `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts`
  - `src/tools/ExitWorktreeTool/ExitWorktreeTool.ts`
  - `src/utils/worktree.ts`
  - `src/components/WorktreeExitDialog.tsx`

## entrypoints
- `src/tools/AgentTool/AgentTool.tsx:196`
  - entree principale pour creer un sous-agent, choisir un agent type, activer le mode background, forker ou lancer un teammate.
- `src/tools/shared/spawnMultiAgent.ts:1088` (`spawnTeammate`)
  - facade commune pour teammates in-process, tmux ou iTerm2.
- `src/utils/swarm/backends/registry.ts:425` (`getTeammateExecutor`)
  - selection du backend effectif.
- `src/utils/tasks.ts:199` (`getTaskListId`)
  - point d'ancrage de la task list persistante.
- `src/utils/teammateMailbox.ts:134` (`writeToMailbox`)
  - primitive de transport inter-agents.
- `src/tools/EnterPlanModeTool/EnterPlanModeTool.ts:36`
  - entree read-only pour basculer la permission session en `plan`.
- `src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts:147`
  - sortie plan mode, approbation locale ou leader-mediated.
- `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts:52`
  - creation d'un worktree de session.
- `src/utils/worktree.ts:902`
  - creation du worktree par-agent pour l'isolation de sous-agent.

## key files
- `src/tools/AgentTool/AgentTool.tsx`
  - decision tree complet: teammate vs subagent, background vs foreground, local vs remote vs worktree.
- `src/tools/AgentTool/runAgent.ts`
  - generator runtime de sous-agent: prompt, MCP, query loop, transcript, cleanup.
- `src/utils/swarm/inProcessRunner.ts`
  - boucle autonome d'un teammate in-process avec mailbox polling et task claiming.
- `src/utils/tasks.ts`
  - store disque de la task list persistante, verrouillee, avec ownership/blocking.
- `src/utils/teammateMailbox.ts`
  - protocole de messages structures entre leader et teammates.
- `src/tools/SendMessageTool/SendMessageTool.ts`
  - routeur vers agent local, inbox teammate, structured approvals et resume.
- `src/utils/swarm/teamHelpers.ts`
  - persistance de team file, mode sync et cleanup.
- `src/utils/worktree.ts`
  - substrate git/hook/tmux pour session worktrees et agent worktrees.
- `src/tasks/LocalAgentTask/LocalAgentTask.tsx`
  - progression et notifications des agents locaux/background.
- `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx`
  - couche remote/CCR, restauration et extraction de plan depuis logs.

## data flow
1. `AgentTool.call` (`src/tools/AgentTool/AgentTool.tsx:239`) choisit d'abord entre spawn teammate et sous-agent normal.
2. Les definitions d'agent sont chargees et filtrees par `loadAgentsDir.ts`:
   - `parseAgentFromMarkdown` (`:541`)
   - `hasRequiredMcpServers` (`:229`)
   - `filterAgentsByMcpRequirements` (`:250`)
3. Pour un teammate, `spawnTeammate` (`src/tools/shared/spawnMultiAgent.ts:1088`) passe par `getTeammateExecutor` (`src/utils/swarm/backends/registry.ts:425`) puis:
   - pane backend (`tmux` / `iterm2`)
   - ou `InProcessBackend`, qui utilise `spawnInProcessTeammate` (`src/utils/swarm/spawnInProcess.ts:104`) puis `startInProcessTeammate` (`src/utils/swarm/inProcessRunner.ts:1544`)
4. Pour un sous-agent local, `runAgent` (`src/tools/AgentTool/runAgent.ts:248`) pilote la boucle de query; `LocalAgentTask` suit la progression (`registerAsyncAgent` `:466`, `updateAgentProgress` `:339`, `completeAgentTask` `:412`).
5. Pour un sous-agent remote, `AgentTool` bifurque vers `checkRemoteAgentEligibility` (`src/tasks/RemoteAgentTask/RemoteAgentTask.tsx:124`) puis `registerRemoteAgentTask` (`:386`).
6. La coordination d'equipe ne passe pas par `AppState.tasks`, mais par `src/utils/tasks.ts`:
   - `createTask` (`:284`)
   - `claimTask` (`:541`)
   - `blockTask` (`:458`)
   - `getAgentStatuses` (`:763`)
7. Les messages et approbations passent par `writeToMailbox` (`src/utils/teammateMailbox.ts:134`) et sont routes par `SendMessageTool`.
8. Les reponses de permissions sont reconnectees au runtime via `useSwarmPermissionPoller.ts`.
9. `EnterPlanMode` / `ExitPlanModeV2` mutent `toolPermissionContext`; `EnterWorktree` / `ExitWorktree` mutent cwd/projectRoot/session state.

## external deps
- `query engine / tool runtime`
  - `runAgent.ts` depend fortement de `ToolUseContext`, `createSubagentContext`, prompt assembly, query loop, tool registry et transcript persistence.
- `filesystem + lockfile`
  - `src/utils/tasks.ts`, `src/utils/teammateMailbox.ts`, `src/utils/swarm/permissionSync.ts`, `src/utils/swarm/teamHelpers.ts`.
- `git / worktree / tmux / hooks`
  - `src/utils/worktree.ts`, `src/tools/EnterWorktreeTool/**`, `src/tools/ExitWorktreeTool/**`, pane backends.
- `MCP / model resolution / analytics`
  - `AgentTool.tsx`, `runAgent.ts`, `coordinatorMode.ts`.
- `permission model`
  - `EnterPlanMode`, `ExitPlanModeV2`, `permissionSetup`, exit plan mode permission UI.
- `remote session runtime`
  - `RemoteAgentTask.tsx` et la branche `isolation: remote` (build ant uniquement).

## flags/env
- `COORDINATOR_MODE`
- `FORK_SUBAGENT`
- `KAIROS`
- `KAIROS_CHANNELS`
- `TRANSCRIPT_CLASSIFIER`
- `UDS_INBOX`
- `VERIFICATION_AGENT`
- `PROACTIVE`
- `CLAUDE_AUTO_BACKGROUND_TASKS`
- `BASH_CLASSIFIER`
- `CLAUDE_CODE_ENABLE_TASKS`
- `CLAUDE_CODE_TASK_LIST_ID`
- `CLAUDE_CODE_TEAM_NAME`
- `CLAUDE_CODE_COORDINATOR_MODE`
- `USER_TYPE === 'ant'`

## feature inventory
- `agent definition loader`
  - JSON/Markdown, built-in/custom/plugin, overrides, MCP requirements, isolation, background, permissionMode.
- `local subagent runtime`
  - generator `runAgent`, foreground/background, prompt cache safe fork path, transcript output.
- `remote subagent runtime`
  - remote eligibility checks, task restore, plan extraction from remote logs.
- `persistent team task list`
  - IDs monotones, file locking, blocking graph, ownership, agent statuses, auto-watch UI.
- `mailbox protocol`
  - permission requests/responses, sandbox approvals, shutdown, plan approval, task assignment, mode set, idle notifications.
- `teammate backends`
  - tmux, iTerm2, in-process, auto-detection and fallback.
- `in-process teammate loop`
  - mailbox + task polling, isolated contexts, autonomous execution loop.
- `coordinator mode`
  - special prompt and worker capability surface.
- `plan mode guardrails`
  - read-only entry, approval exit, mode restoration, plan naming.
- `session and agent worktrees`
  - session-level Enter/ExitWorktree and per-agent isolated worktrees in `AgentTool`.

## agent definitions
- `src/tools/AgentTool/loadAgentsDir.ts`
  - `getAgentDefinitionsWithOverrides` (`:296`) est le point de resolution principal.
  - `parseAgentFromJson` (`:445`) et `parseAgentFromMarkdown` (`:541`) materialisent des `AgentDefinition`.
  - champs importants exposes par le parser: `tools`, `disallowedTools`, `skills`, `mcpServers`, `hooks`, `model`, `effort`, `permissionMode`, `maxTurns`, `background`, `memory`, `isolation`, `requiredMcpServers`, `omitClaudeMd`.
  - `hasRequiredMcpServers` (`:229`) et `filterAgentsByMcpRequirements` (`:250`) sont les gates de disponibilite.
- `src/tools/AgentTool/forkSubagent.ts`
  - `FORK_SUBAGENT_TYPE` (`:42`)
  - `FORK_AGENT` (`:60`)
  - `buildForkedMessages` (`:107`)
  - `buildWorktreeNotice` (`:205`)
- `src/tools/AgentTool/agentToolUtils.ts`
  - `filterToolsForAgent` (`:70`) applique les allow/disallow rules; important detail: les teammates in-process gardent les outils de coordination (`Agent`, `SendMessage`, `Team*`, `Task*`) meme avec un allowlist strict.
  - `resolveAgentTools` (`:122`) produit l'outillage final.

## agent runtime
- `src/tools/AgentTool/AgentTool.tsx`
  - entree tool: `AgentTool` (`:196`), `call` (`:239`).
  - spawn teammate si `team_name` et `name` sont renseignes (`:262-298`).
  - selection de l'agent effectif via `effectiveType` / `selectedAgent` (`:319-358`).
  - gate MCP obligatoire (`:367-408`).
  - isolation effective: `effectiveIsolation` (`:431`).
  - branche remote ant-only (`:435-467`).
  - branche worktree locale (`:582-604`).
  - cleanup worktree post-run dans `cleanupWorktreeIfNeeded` (`:644-683`).
  - voie async/background via `registerAsyncAgent` (`:688`) et `runAsyncAgentLifecycle`.
  - voie foreground avec bascule eventuelle vers background (`:808-1201`).
- `src/tools/AgentTool/runAgent.ts`
  - `runAgent` est un async generator (`:248`) plutot qu'une fonction "one shot".
  - options critiques:
    - `allowedTools` (`:262`, `:465-476`)
    - `useExactTools` (`:265`, `:500`, `:679-694`)
    - `transcriptSubdir` (`:268`, `:351-352`)
    - `onQueryProgress` (`:269`, `:758`)
  - `filterIncompleteToolCalls` (`:866`) nettoie les transcripts partiels.
  - `getAgentSystemPrompt` (`:906`) assemble le prompt final.
- `src/tasks/LocalAgentTask/LocalAgentTask.tsx`
  - `queuePendingMessage` (`:162`)
  - `appendMessageToLocalAgent` (`:175`)
  - `drainPendingMessages` (`:181`)
  - `updateAgentProgress` (`:339`)
  - `updateAgentSummary` (`:359`)
  - `completeAgentTask` (`:412`)
  - `failAgentTask` (`:437`)
  - `registerAsyncAgent` (`:466`)
  - `registerAgentForeground` (`:526`)
  - `backgroundAgentTask` (`:620`)
- `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx`
  - `checkRemoteAgentEligibility` (`:124`)
  - `extractPlanFromLog` (`:208`)
  - `registerRemoteAgentTask` (`:386`)
  - `restoreRemoteAgentTasks` (`:477`)
- `src/tasks/LocalMainSessionTask.ts`
  - le main session backgrounding reutilise le type `local_agent`; c'est un detail important si on essaie d'extraire le runtime sans le reste du shell.

## tasks lifecycle
- Il faut distinguer strictement deux couches:
  - runtime tasks UI/kill/output
  - task list persistante pour la coordination
- `runtime task state`
  - `src/Task.ts`
    - `generateTaskId` (`:98`)
    - `createTaskStateBase` (`:108`)
  - `src/utils/task/framework.ts`
    - `updateTaskState` (`:48`)
    - `registerTask` (`:77`)
    - `evictTerminalTask` (`:125`)
  - `src/tasks/stopTask.ts`
    - `stopTask` (`:38`)
  - `src/tools/TaskStopTool/TaskStopTool.ts`
    - `TaskStopTool` (`:39`) agit sur `AppState.tasks`, pas sur la task list persistante.
  - `src/tools/TaskOutputTool/TaskOutputTool.tsx`
    - `getTaskOutputData` (`:60`)
    - `waitForTaskCompletion` (`:118`)
    - `TaskOutputTool` (`:144`)
- `persistent task list`
  - `src/utils/tasks.ts`
    - `setLeaderTeamName` (`:31`) / `clearLeaderTeamName` (`:43`)
    - `getTaskListId` (`:199`)
    - `createTask` (`:284`)
    - `getTask` (`:310`)
    - `updateTask` (`:370`)
    - `blockTask` (`:458`)
    - `claimTask` (`:541`)
    - `getAgentStatuses` (`:763`)
    - `unassignTeammateTasks` (fin de fichier)
  - `src/tools/TaskCreateTool/TaskCreateTool.ts`
    - `TaskCreateTool` (`:48`)
    - appelle `createTask` (`:81`)
    - lance `executeTaskCreatedHooks` (`:92`)
  - `src/tools/TaskGetTool/TaskGetTool.ts`
    - `TaskGetTool` (`:38`)
  - `src/tools/TaskListTool/TaskListTool.ts`
    - `TaskListTool` (`:33`)
    - masque les blockers deja resolus dans sa sortie (`:73-77`)
  - `src/tools/TaskUpdateTool/TaskUpdateTool.ts`
    - `TaskUpdateTool` (`:88`)
    - auto-owner quand un teammate passe en `in_progress` (`:194`)
    - notification d'assignation par mailbox (`:278`)
    - nudge de verification si on clot >3 taches sans verification (`:340`)
- `UI / hooks`
  - `src/hooks/useTasksV2.ts`
    - `useTasksV2` (`:218`)
    - store singleton avec watcher partage et hide-after-complete.
    - le hook n'est actif que pour le leader ou hors team.
  - `src/hooks/useTaskListWatcher.ts`
    - `useTaskListWatcher` (`:34`)
    - pattern autonome `watch directory -> claimTask -> soumettre comme prompt`.
  - `src/components/TaskListV2.tsx`
    - vue persistante de la task list, pas du runtime background task panel.

## team orchestration
- `src/tools/TeamCreateTool/TeamCreateTool.ts`
  - `TeamCreateTool` (`:74`)
  - genere un `leadAgentId`, ecrit le `TeamFile`, reset le task list dir, puis appelle `setLeaderTeamName`.
  - `setLeaderTeamName` est obligatoire pour que le leader et les teammates ecrivent dans la meme task list.
- `src/tools/TeamDeleteTool/TeamDeleteTool.ts`
  - `TeamDeleteTool` (`:32`)
  - refuse le cleanup si des non-lead members ont `isActive !== false`.
  - appelle `cleanupTeamDirectories`, `unregisterTeamForSessionCleanup`, `clearLeaderTeamName`.
- `src/utils/swarm/teamHelpers.ts`
  - `sanitizeName` (`:100`), `sanitizeAgentName` (`:108`)
  - `readTeamFile` (`:131`)
  - `removeMemberByAgentId` (`:326`)
  - `setMemberMode` (`:357`)
  - `syncTeammateMode` (`:397`)
  - `setMemberActive` (`:454`)
  - `registerTeamForSessionCleanup` (`:560`)
  - `cleanupSessionTeams` (`:576`)
  - `cleanupTeamDirectories` (`:641`)
- `src/coordinator/coordinatorMode.ts`
  - `isCoordinatorMode` (`:36`)
  - `matchSessionMode` (`:49`)
  - `getCoordinatorUserContext` (`:80`)
  - `getCoordinatorSystemPrompt` (`:111`)
  - pattern utile: injecter un system prompt specialise + un sous-ensemble d'outils worker-safe.
- `src/hooks/useSwarmInitialization.ts`
  - `useSwarmInitialization` (`:30`)
  - rehydrate les resumed teammate sessions depuis le transcript, sinon lit le contexte dynamique env/ALS.

## backend abstraction
- `src/utils/swarm/backends/types.ts`
  - `BackendType = 'tmux' | 'iterm2' | 'in-process'`
  - `PaneBackend` = operations de fenetre/pane
  - `TeammateExecutor` = operations de haut niveau `spawn/sendMessage/terminate/kill/isActive`
- `src/utils/swarm/backends/registry.ts`
  - `detectAndGetBackend` (`:136`)
  - `markInProcessFallback` (`:326`)
  - `isInProcessEnabled` (`:351`)
  - `getResolvedTeammateMode` (`:396`)
  - `getInProcessBackend` (`:404`)
  - `getTeammateExecutor` (`:425`)
  - `resetBackendDetection` (`:457`)
- `src/utils/swarm/backends/InProcessBackend.ts`
  - `setContext`
  - `spawn` route vers `spawnInProcessTeammate` puis `startInProcessTeammate`
  - `terminate` envoie un `shutdown_request` par mailbox
  - `kill` passe par `killInProcessTeammate`
- `src/tools/shared/spawnMultiAgent.ts`
  - `resolveTeammateModel` (`:93`)
  - `generateUniqueTeammateName` (`:267`)
  - `handleSpawnSplitPane` (`:305`)
  - `handleSpawnSeparateWindow` (`:545`)
  - `registerOutOfProcessTeammateTask` (`:760`)
  - `handleSpawnInProcess` (`:840`)
  - `spawnTeammate` (`:1088`)
- Pattern important:
  - les teammates pane-based et in-process partagent la meme abstraction `TeammateExecutor`
  - les teammates pane-based sont quand meme representes dans `AppState.tasks` via `registerOutOfProcessTeammateTask`
  - l'execution et la presentation UI sont donc decouplees

## plan mode guardrails
- `src/tools/EnterPlanModeTool/EnterPlanModeTool.ts`
  - `EnterPlanModeTool` (`:36`)
  - interdit dans les contexts agent.
  - passe `toolPermissionContext.mode` en `plan`.
  - renvoie des instructions read-only explicites.
  - se desactive si `KAIROS/KAIROS_CHANNELS` + channels actifs.
- `src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts`
  - `ExitPlanModeV2Tool` (`:147`)
  - lit le plan depuis le disque ou depuis l'input edite.
  - pour un teammate avec `isPlanModeRequired()`, envoie un `plan_approval_request` au leader via mailbox et n'exige pas d'UI locale.
  - restaure `prePlanMode`, gere le gate auto-mode, et peut ajouter des `allowedPrompts`.
- `src/components/permissions/EnterPlanModePermissionRequest/EnterPlanModePermissionRequest.tsx`
  - `EnterPlanModePermissionRequest` (`:11`) est UI-only.
- `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`
  - `buildPermissionUpdates` (`:56`)
  - `autoNameSessionFromPlan` (`:83`)
  - `ExitPlanModePermissionRequest` (`:118`)
  - ce composant porte la logique d'accept/reject et l'auto-naming session.
- `src/components/messages/PlanApprovalMessage.tsx`
  - `PlanApprovalRequestDisplay` (`:17`)
  - `PlanApprovalResponseDisplay` (`:66`)
  - `tryRenderPlanApprovalMessage` (`:137`)
  - `formatTeammateMessageContent` (`:190`)
- `src/utils/teammateMailbox.ts`
  - `PlanApprovalRequestMessageSchema` (`:684`)
  - `PlanApprovalResponseMessageSchema` (`:702`)
  - `isPlanApprovalRequest` (`:885`)
  - `isPlanApprovalResponse` (`:936`)
- `src/tools/SendMessageTool/SendMessageTool.ts`
  - `handlePlanApproval` (`:434`)
  - `handlePlanRejection` (`:478`)

## worktree isolation
- `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts`
  - `EnterWorktreeTool` (`:52`)
  - refuse si une session worktree existe deja.
  - recentre la session sur le git root canonique.
  - appelle `createWorktreeForSession`.
  - reset caches `systemPrompt`, `claudemd`, `plans`.
- `src/tools/ExitWorktreeTool/ExitWorktreeTool.ts`
  - `restoreSessionToOriginalCwd` (`:122`)
  - `ExitWorktreeTool` (`:148`)
  - validation fail-closed: refuse `remove` si l'etat git n'est pas verifiable ou si des changements/commits existent sans `discard_changes: true`.
- `src/utils/worktree.ts`
  - `validateWorktreeSlug` (`:66`)
  - `getCurrentWorktreeSession` (`:158`)
  - `generateTmuxSessionName` (`:171`)
  - `createWorktreeForSession` (`:702`)
  - `keepWorktree` (`:780`)
  - `cleanupWorktree` (`:813`)
  - `createAgentWorktree` (`:902`)
  - `removeAgentWorktree` (`:961`)
  - `cleanupStaleAgentWorktrees` (`:1058`)
  - `hasWorktreeChanges` (`:1144`)
- `src/tools/AgentTool/AgentTool.tsx`
  - re-emploie `createAgentWorktree` pour l'isolation per-agent (`:582-604`)
  - ne supprime le worktree qu'apres `hasWorktreeChanges` dans `cleanupWorktreeIfNeeded` (`:644-683`)
- `src/components/WorktreeExitDialog.tsx`
  - `WorktreeExitDialog` (`:29`) est un chemin UI parallele pour quitter une session en fin de shell; ne pas le confondre avec le coeur reutilisable `Enter/ExitWorktree + utils/worktree.ts`.

## symbol map
### creer un agent
| Operation | Symboles critiques | Fichiers | Notes |
| --- | --- | --- | --- |
| Charger une definition | `parseAgentFromMarkdown`, `parseAgentFromJson`, `getAgentDefinitionsWithOverrides` | `src/tools/AgentTool/loadAgentsDir.ts` | Parse built-in/custom/plugin + frontmatter. |
| Verifier prerequis | `hasRequiredMcpServers`, `filterAgentsByMcpRequirements` | `src/tools/AgentTool/loadAgentsDir.ts` | Gate MCP obligatoire avant spawn. |
| Choisir le toolset | `filterToolsForAgent`, `resolveAgentTools` | `src/tools/AgentTool/agentToolUtils.ts` | Les teammates gardent les outils de coordination. |
| Creer le runtime | `AgentTool.call`, `runAgent` | `src/tools/AgentTool/AgentTool.tsx`, `src/tools/AgentTool/runAgent.ts` | Decision tree complet. |
| Enregistrer une tache d'agent | `registerAsyncAgent`, `registerAgentForeground`, `registerRemoteAgentTask` | `src/tasks/LocalAgentTask/LocalAgentTask.tsx`, `src/tasks/RemoteAgentTask/RemoteAgentTask.tsx` | Runtime local vs remote. |

### lancer un sous-agent / teammate
| Operation | Symboles critiques | Fichiers | Notes |
| --- | --- | --- | --- |
| Spawn teammate | `spawnTeammate` | `src/tools/shared/spawnMultiAgent.ts` | Facade commune. |
| Choisir backend | `getTeammateExecutor`, `getResolvedTeammateMode`, `detectAndGetBackend` | `src/utils/swarm/backends/registry.ts` | Auto -> tmux/iTerm2/in-process. |
| Spawn in-process | `spawnInProcessTeammate`, `startInProcessTeammate` | `src/utils/swarm/spawnInProcess.ts`, `src/utils/swarm/inProcessRunner.ts` | ALS + task registration. |
| Spawn pane-based | `handleSpawnSplitPane`, `handleSpawnSeparateWindow`, `registerOutOfProcessTeammateTask` | `src/tools/shared/spawnMultiAgent.ts` | UI task locale, execution externe. |
| Fork child | `FORK_AGENT`, `buildForkedMessages`, `buildWorktreeNotice` | `src/tools/AgentTool/forkSubagent.ts` | Prompt-cache-stable fork workers. |

### suivre la progression
| Operation | Symboles critiques | Fichiers | Notes |
| --- | --- | --- | --- |
| Progress runtime agent | `updateAgentProgress`, `updateAgentSummary`, `completeAgentTask`, `failAgentTask` | `src/tasks/LocalAgentTask/LocalAgentTask.tsx` | Progress token/tool/activity. |
| Progress UI panel | `getVisibleAgentTasks` | `src/components/CoordinatorAgentStatus.tsx` | Vue sur les `local_agent` visibles. |
| Lire output runtime | `TaskOutputTool`, `getTaskOutputData`, `waitForTaskCompletion` | `src/tools/TaskOutputTool/TaskOutputTool.tsx` | Agit sur `AppState.tasks`, pas sur la task list persistante. |
| Lire / watcher task list | `TaskListTool`, `TaskGetTool`, `useTasksV2`, `useTaskListWatcher` | `src/tools/TaskListTool/TaskListTool.ts`, `src/tools/TaskGetTool/TaskGetTool.ts`, `src/hooks/useTasksV2.ts`, `src/hooks/useTaskListWatcher.ts` | Vue du store disque. |
| Auto-claim work item | `claimTask` | `src/utils/tasks.ts` | Ownership atomique. |

### router des messages
| Operation | Symboles critiques | Fichiers | Notes |
| --- | --- | --- | --- |
| Mailbox write | `writeToMailbox` | `src/utils/teammateMailbox.ts` | Primitive centrale. |
| Message direct | `handleMessage` | `src/tools/SendMessageTool/SendMessageTool.ts` | Peut viser agent local ou teammate. |
| Broadcast | `handleBroadcast` | `src/tools/SendMessageTool/SendMessageTool.ts` | Pas de structured broadcast. |
| Resume agent local | `queuePendingMessage`, `resumeAgentBackground` | `src/tasks/LocalAgentTask/LocalAgentTask.tsx`, `src/tools/AgentTool/resumeAgent.ts` | Reveille un agent background/evicte. |
| Injecter vers teammate | `injectUserMessageToTeammate` | `src/tasks/InProcessTeammateTask/InProcessTeammateTask.tsx` | Append dans la conversation du teammate. |
| Permissions mailbox | `sendPermissionRequestViaMailbox`, `sendPermissionResponseViaMailbox`, `processMailboxPermissionResponse` | `src/utils/swarm/permissionSync.ts`, `src/hooks/useSwarmPermissionPoller.ts` | Bridge leader <-> worker. |

### gerer les worktrees
| Operation | Symboles critiques | Fichiers | Notes |
| --- | --- | --- | --- |
| Session worktree create | `createWorktreeForSession`, `EnterWorktreeTool` | `src/utils/worktree.ts`, `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts` | Mutations de cwd + session state. |
| Session worktree exit | `cleanupWorktree`, `keepWorktree`, `ExitWorktreeTool` | `src/utils/worktree.ts`, `src/tools/ExitWorktreeTool/ExitWorktreeTool.ts` | Keep/remove avec dirty checks. |
| Agent worktree create | `createAgentWorktree` | `src/utils/worktree.ts` | Utilise par `AgentTool`. |
| Agent worktree cleanup | `hasWorktreeChanges`, `removeAgentWorktree`, `cleanupWorktreeIfNeeded` | `src/utils/worktree.ts`, `src/tools/AgentTool/AgentTool.tsx` | Keep si changements detectes. |
| Stale cleanup | `cleanupStaleAgentWorktrees` | `src/utils/worktree.ts` | Maintenance sessionnelle. |

## dependency map
| Slice | Dependances directes | Couplages bloquants |
| --- | --- | --- |
| `AgentTool` | `loadAgentsDir`, `agentToolUtils`, `runAgent`, `LocalAgentTask`, `RemoteAgentTask`, `spawnMultiAgent`, `utils/worktree` | `ToolUseContext`, prompt system, MCP, analytics, bootstrap state |
| `runAgent` | query loop, `createSubagentContext`, MCP init, transcript/session storage, prompt assembly | tres fort couplage au runtime global |
| `persistent task list` | `src/utils/tasks.ts`, `lockfile`, `fs/promises`, `team identity` | hooks create/complete, leaderTeamName side effect |
| `mailbox protocol` | `teammateMailbox`, `permissionSync`, `SendMessageTool`, UI message renderers | team dir layout, permission callback registry, resumeAgent path |
| `backend registry` | `backends/types`, `registry`, `InProcessBackend`, `PaneBackendExecutor`, `teamHelpers` | tmux/iTerm detection, ToolUseContext injection |
| `in-process teammate runtime` | `spawnInProcess`, `inProcessRunner`, `agentContext`, `teammateContext`, `runAgent` | AsyncLocalStorage + same-process side effects |
| `plan mode` | `EnterPlanMode`, `ExitPlanModeV2`, plan file helpers, permission UI, mailbox plan approval | permission model, auto-mode state, team approval protocol |
| `worktree runtime` | `Enter/ExitWorktree`, `utils/worktree`, `sessionStorage`, `git`, `tmux` | git/hook wrappers, cwd/projectRoot/originalCwd invariants |

## UI vs runtime split
- `runtime-first`
  - `src/tools/AgentTool/AgentTool.tsx`
  - `src/tools/AgentTool/runAgent.ts`
  - `src/utils/tasks.ts`
  - `src/utils/teammateMailbox.ts`
  - `src/utils/swarm/**`
  - `src/utils/worktree.ts`
- `UI-only or mostly UI`
  - `src/components/CoordinatorAgentStatus.tsx`
  - `src/components/TaskListV2.tsx`
  - `src/components/WorktreeExitDialog.tsx`
  - `src/components/messages/PlanApprovalMessage.tsx`
  - `src/components/messages/TaskAssignmentMessage.tsx`
  - `src/components/permissions/EnterPlanModePermissionRequest/EnterPlanModePermissionRequest.tsx`
  - `src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx`
- `mixed hooks / read models`
  - `src/hooks/useSwarmInitialization.ts`
  - `src/hooks/useSwarmPermissionPoller.ts`
  - `src/hooks/useTasksV2.ts`
  - `src/hooks/useTaskListWatcher.ts`
  - `src/components/PromptInput/useSwarmBanner.ts`

## extraction recipes
| Slice | Plus petite extraction viable | Fichiers minimum | Ce qu'il faut rebrancher | Difficulte |
| --- | --- | --- | --- | --- |
| `task lifecycle` | task list persistante seulement | `src/utils/tasks.ts`, `src/tools/TaskCreateTool/TaskCreateTool.ts`, `src/tools/TaskGetTool/TaskGetTool.ts`, `src/tools/TaskListTool/TaskListTool.ts`, `src/tools/TaskUpdateTool/TaskUpdateTool.ts` | config dir, `lockfile`, hooks create/complete, identite team/session | moyenne |
| `team backend abstraction` | registry + backend in-process | `src/utils/swarm/backends/types.ts`, `src/utils/swarm/backends/registry.ts`, `src/utils/swarm/backends/InProcessBackend.ts`, `src/utils/swarm/spawnInProcess.ts`, `src/utils/swarm/inProcessRunner.ts` | `ToolUseContext`, team file helpers, mailbox, `runAgent` | elevee |
| `plan controls` | enter/exit plan mode sans UI team | `src/tools/EnterPlanModeTool/EnterPlanModeTool.ts`, `src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts`, plan file helpers, permission update builder | `toolPermissionContext`, plan file storage, permission model | moyenne a elevee |
| `worktree controls` | enter/exit session worktree | `src/tools/EnterWorktreeTool/EnterWorktreeTool.ts`, `src/tools/ExitWorktreeTool/ExitWorktreeTool.ts`, `src/utils/worktree.ts` | git root detection, session storage, cwd/projectRoot state, tmux cleanup | elevee |
| `mailbox protocol` | message + permission bridge | `src/utils/teammateMailbox.ts`, `src/utils/swarm/permissionSync.ts`, `src/hooks/useSwarmPermissionPoller.ts` | team dir layout, permission callbacks, UI/message rendering | moyenne |

## minimal reusable slices
- `persistent_task_list`
  - meilleur candidat si l'objectif est `deleguer du travail a des workers` sans copier tout le runtime d'agent.
- `swarm_mailbox_protocol`
  - meilleur candidat si l'objectif est `router approvals / DM / plan approval` entre processus.
- `swarm_backend_registry`
  - utile si on veut garder une abstraction `pane vs in-process`.
- `in_process_teammate_runtime`
  - utile si on veut des sous-agents meme-process avec isolation logique, mais sans tmux.
- `plan_mode_guardrails`
  - utile si on veut imposer une phase read-only et une sortie approuvee.
- `worktree_isolation_runtime`
  - utile si on veut isolation git/worktree reutilisable.

## do not copy blindly
- Ne pas confondre `TaskCreate/TaskList/TaskUpdate` avec `TaskStop/TaskOutput`.
  - les premiers manipulent `src/utils/tasks.ts`
  - les seconds manipulent `AppState.tasks`
- Ne pas copier `TeamCreateTool` sans `setLeaderTeamName`.
  - sinon le leader et les teammates ecrivent dans des task lists differentes.
- Ne pas copier `SendMessageTool` sans `src/utils/teammateMailbox.ts` et `src/utils/swarm/permissionSync.ts`.
  - la moitie de la logique visible est en fait du protocole structure.
- Ne pas copier `InProcessBackend` sans `ToolUseContext` et sans `inProcessRunner`.
  - le backend seul ne sait ni poller, ni executer, ni nettoyer.
- Ne pas copier `ExitPlanModeV2Tool` sans `ExitPlanModePermissionRequest`.
  - la sortie plan mode depend des `PermissionUpdate` construits par l'UI.
- Ne pas copier `utils/worktree.ts` a moitie.
  - la couche gere git root, hook-based worktrees, tmux, `sessionStorage`, `projectRoot`, `originalCwd`, stale cleanup.
- Ne pas supposer qu'un teammate pane-based n'a pas de representation locale.
  - `registerOutOfProcessTeammateTask` cree quand meme une tache UI locale.
- Ne pas extraire `runAgent.ts` comme `mini runtime`.
  - il depend d'une grosse partie du shell: prompt, MCP, permissions, transcript, compaction, query.

## reusable ideas
- abstraction `TeammateExecutor` pour separer spawn/send/terminate de la presentation UI
- task list persistante verrouillee avec ownership + blocking graph
- protocole mailbox structure pour approvals et coordination
- plan mode comme mutation de permission context plutot que mode global opaque
- worktree per-agent nettoye seulement apres verif de changements

## reusable features
- `agent_orchestration`
  - grand ensemble, utile pour reference globale mais trop couple pour une copie selective.
- `persistent_task_list`
  - meilleure extraction B04 pour coordination sans sous-agents complets.
- `swarm_mailbox_protocol`
  - meilleur bloc B04 pour approvals/messages inter-agents.
- `swarm_backend_registry`
  - bon point d'entree si on veut garder `tmux|iTerm|in-process`.
- `in_process_teammate_runtime`
  - extraction viable si on accepte de recabler `runAgent`.
- `plan_mode_guardrails`
  - bon slice si on veut imposer une phase de planification approuvee.
- `worktree_isolation_runtime`
  - bon slice si on veut isolation git/worktree reutilisable.
- `plan_worktree_controls`
  - feature large legacy; a preferer comme reference, pas comme copie `as is`.

## copy risk
- Couplage tres eleve entre runtime d'agent, bootstrap state, permissions, MCP, transcript et UI.
- Les points les plus sensibles sont:
  - dualite des tasks
  - side effects `leaderTeamName`
  - mailbox protocol + pollers
  - `AsyncLocalStorage` pour teammates in-process
  - git/tmux/session state dans `utils/worktree.ts`

## exact search shortcuts
```bash
rg -n "parseAgentFromMarkdown|hasRequiredMcpServers|filterAgentsByMcpRequirements" src/tools/AgentTool/loadAgentsDir.ts
rg -n "effectiveIsolation|createAgentWorktree|removeAgentWorktree|cleanupWorktreeIfNeeded" src/tools/AgentTool/AgentTool.tsx
rg -n "runAgent\\s*\\(|allowedTools|useExactTools|createSubagentContext" src/tools/AgentTool/runAgent.ts
rg -n "resolveTeammateModel|generateUniqueTeammateName|registerOutOfProcessTeammateTask|handleSpawnInProcess|spawnTeammate" src/tools/shared/spawnMultiAgent.ts
rg -n "detectAndGetBackend|getTeammateExecutor|getResolvedTeammateMode|markInProcessFallback" src/utils/swarm/backends/registry.ts
rg -n "spawnInProcessTeammate|killInProcessTeammate" src/utils/swarm/spawnInProcess.ts
rg -n "runInProcessTeammate|startInProcessTeammate" src/utils/swarm/inProcessRunner.ts
rg -n "createTask\\(|claimTask\\(|blockTask\\(|getTaskListId\\(|getAgentStatuses" src/utils/tasks.ts
rg -n "TaskCreateTool|TaskGetTool|TaskListTool|TaskUpdateTool" src/tools/Task*Tool/*.ts
rg -n "TaskOutputTool|getTaskOutputData|waitForTaskCompletion" src/tools/TaskOutputTool/TaskOutputTool.tsx
rg -n "handleMessage|handleBroadcast|handlePlanApproval|handlePlanRejection|resumeAgentBackground" src/tools/SendMessageTool/SendMessageTool.ts
rg -n "writeToMailbox|PlanApprovalRequestMessageSchema|isStructuredProtocolMessage|sendShutdownRequestToMailbox" src/utils/teammateMailbox.ts
rg -n "sendPermissionRequestViaMailbox|sendPermissionResponseViaMailbox|pollForResponse" src/utils/swarm/permissionSync.ts
rg -n "EnterPlanModeTool|ExitPlanModeV2Tool" src/tools/EnterPlanModeTool/EnterPlanModeTool.ts src/tools/ExitPlanModeTool/ExitPlanModeV2Tool.ts
rg -n "buildPermissionUpdates|autoNameSessionFromPlan|ExitPlanModePermissionRequest" src/components/permissions/ExitPlanModePermissionRequest/ExitPlanModePermissionRequest.tsx
rg -n "createWorktreeForSession|keepWorktree|cleanupWorktree|createAgentWorktree|removeAgentWorktree|cleanupStaleAgentWorktrees|hasWorktreeChanges" src/utils/worktree.ts
rg -n "useTasksV2|useTaskListWatcher|useSwarmPermissionPoller|useSwarmInitialization" src/hooks/useTasksV2.ts src/hooks/useTaskListWatcher.ts src/hooks/useSwarmPermissionPoller.ts src/hooks/useSwarmInitialization.ts
rg -n "getVisibleAgentTasks|TaskListV2|WorktreeExitDialog|formatTeammateMessageContent" src/components/CoordinatorAgentStatus.tsx src/components/TaskListV2.tsx src/components/WorktreeExitDialog.tsx src/components/messages/PlanApprovalMessage.tsx
```

## search hints
- `generateTaskId`
- `getTaskListId`
- `writeToMailbox`
- `spawnTeammate`
- `runInProcessTeammate`
- `EnterPlanModeTool`
- `ExitPlanModeV2Tool`
- `createAgentWorktree`
- `cleanupWorktreeIfNeeded`
