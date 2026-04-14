# Analysis Index

## Snapshot
- Source analysee: `src/` dans `claude-code-leak-fork-main`.
- Total fichiers: 1902.
- Total lignes: 513237.
- Runtime d'indexation: Python 3.13.12 ; Bun non requis.

## Manifests
| Fichier | Role |
| --- | --- |
| `manifests/file_inventory.jsonl` | inventaire par fichier avec lots, imports, exports, mots-cles et roles |
| `manifests/import_graph.jsonl` | aretes d'import internes/externes |
| `manifests/feature_catalog.jsonl` | catalogue des capacites reutilisables |
| `manifests/domain_map.json` | regles + affectations exactes de tous les fichiers |
| `manifests/system_summary.json` | synthese machine-friendly des volumes, hubs et lots |

## Lots d'analyse
| Batch | Priorite | Fichiers | Lignes | Focus | Document |
| --- | --- | ---: | ---: | --- | --- |
| `B01` | haute | 16 | 14529 | Core bootstrap & session loop | [B01](batches/b01-core-bootstrap-session-loop.md) |
| `B02` | moyenne | 228 | 39853 | Command system & CLI transports | [B02](batches/b02-command-system-cli-transports.md) |
| `B03` | haute | 117 | 50323 | Tool system: shell/file/web/search | [B03](batches/b03-tool-system-shell-file-web-search.md) |
| `B04` | haute | 153 | 32556 | Agent orchestration | [B04](batches/b04-agent-orchestration.md) |
| `B05` | haute | 140 | 51221 | MCP, LSP, plugins, skills | [B05](batches/b05-mcp-lsp-plugins-skills.md) |
| `B06` | moyenne | 444 | 95723 | REPL & UI shell | [B06](batches/b06-repl-ui-shell.md) |
| `B07` | moyenne | 121 | 28725 | Terminal engine & interaction model | [B07](batches/b07-terminal-engine-interaction-model.md) |
| `B08` | haute | 45 | 15955 | Bridge, remote & IDE integration | [B08](batches/b08-bridge-remote-ide-integration.md) |
| `B09` | haute | 103 | 34206 | Memory, state, settings & policy | [B09](batches/b09-memory-state-settings-policy.md) |
| `B10` | moyenne | 535 | 150146 | Shared infra, auth, analytics & edge features | [B10](batches/b10-shared-infra-auth-analytics-edge-features.md) |

## Hubs internes a surveiller
- `src/utils/debug.ts` - 106 dependants internes
- `src/services/analytics/index.ts` - 102 dependants internes
- `src/utils/envUtils.ts` - 82 dependants internes
- `src/utils/log.ts` - 71 dependants internes
- `src/utils/errors.ts` - 51 dependants internes
- `src/utils/config.ts` - 48 dependants internes
- `src/utils/slowOperations.ts` - 47 dependants internes
- `src/utils/fsOperations.ts` - 43 dependants internes
- `src/utils/messages.ts` - 40 dependants internes
- `src/bootstrap/state.ts` - 35 dependants internes
- `src/entrypoints/agentSdkTypes.ts` - 35 dependants internes
- `src/utils/cwd.ts` - 35 dependants internes

## Raccourcis de recherche
| Question | Aller d'abord vers |
| --- | --- |
| Demarrage de session | `B01`, `src/main.tsx`, `bootstrap_parallel_prefetch`, `session_bootstrap_runtime` |
| Contexte de session | `B01`, `src/context.ts`, `session_context_snapshot` |
| Boucle de requete | `B01`, `src/query.ts`, `query_loop_skeleton` |
| Permissions shell | `B03`, `src/tools/BashTool/`, `bash_safety_layer` |
| Orchestration d'agents | `B04`, `src/tools/AgentTool/`, `agent_orchestration` |
| MCP / plugins | `B05`, `src/services/mcp/`, `plugin_loader`, `mcp_layer` |
| Demarrage REPL | `B06`, `src/screens/REPL.tsx`, `repl_shell` |
| Memory / settings | `B09`, `src/memdir/`, `settings_policy` |
| API / auth | `B10`, `src/services/api/`, `oauth_stack`, `api_client` |

## Repartition macroscopique
- Top repertoires par volume: utils (180487 lignes), components (81892 lignes), services (53683 lignes), tools (50863 lignes), commands (26528 lignes), ink (19859 lignes), hooks (19232 lignes), bridge (12613 lignes), cli (12355 lignes), root (11972 lignes).
- Features cataloguees: 89.
- Ordre de lecture recommande: B01, B03, B04, B05, B08, B09, B02, B06, B07, B10.

## Regeneration
- `python analysis/scripts/generate_analysis.py`
- Voir aussi `reuse/reuse-candidates.md` pour les briques a copier en priorite.
