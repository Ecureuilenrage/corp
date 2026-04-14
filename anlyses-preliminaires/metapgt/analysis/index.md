# MetaGPT Analysis Index

Generated at: `2026-04-08T10:20:06+00:00`

## Repo shape

- Primary language: `Python`
- Package root: `metagpt/`
- Python LOC under repo: `88865`
- Inventory files scanned (excluding analysis/): `1256`
- Source-like files covered by domain map: `1139` / `1139`
- Major surfaces present: tests, docs, examples, config, Docker, CI, devcontainer

## Fast navigation

- Runtime core starts at `metagpt/config2.py`, `metagpt/context.py`, `metagpt/schema.py`.
- Team orchestration starts at `metagpt/software_company.py`, `metagpt/team.py`, `metagpt/roles/role.py`.
- Action/SOP logic starts at `metagpt/actions/` and `metagpt/strategy/planner.py`.
- LLM abstraction starts at `metagpt/provider/base_llm.py` and `metagpt/provider/llm_provider_registry.py`.
- Tools and execution helpers start at `metagpt/tools/tool_registry.py`, `metagpt/tools/search_engine.py`, `metagpt/utils/project_repo.py`.
- Retrieval stack starts at `metagpt/rag/engines/simple.py`, `metagpt/rag/factories/retriever.py`, `metagpt/exp_pool/decorator.py`.
- Domain-specific environments/extensions start at `metagpt/environment/` and `metagpt/ext/`.

## Proposed batches

- `B01-core-runtime-config` -> `analysis/batches/01-core-runtime-config.md` [files=35, py_files=35, py_loc=3342]
- `B02-agent-orchestration` -> `analysis/batches/02-agent-orchestration.md` [files=27, py_files=27, py_loc=3886]
- `B03-actions-planning-prompts` -> `analysis/batches/03-actions-planning-prompts.md` [files=128, py_files=87, py_loc=12804]
- `B04-llm-provider-layer` -> `analysis/batches/04-llm-provider-layer.md` [files=30, py_files=30, py_loc=3778]
- `B05-tools-utils-execution` -> `analysis/batches/05-tools-utils-execution.md` [files=110, py_files=103, py_loc=15452]
- `B06-rag-doc-knowledge` -> `analysis/batches/06-rag-doc-knowledge.md` [files=60, py_files=60, py_loc=4893]
- `B07-environments-extensions` -> `analysis/batches/07-environments-extensions.md` [files=256, py_files=167, py_loc=17604]
- `B08-tests-examples-docs-infra` -> `analysis/batches/08-tests-examples-docs-infra.md` [files=610, py_files=381, py_loc=27106]

## Highest-value hubs

- `metagpt/logs.py` [inbound_imports=246, lines=153]
- `metagpt/utils/common.py` [inbound_imports=143, lines=1243]
- `metagpt/const.py` [inbound_imports=132, lines=164]
- `metagpt/schema.py` [inbound_imports=130, lines=976]
- `metagpt/actions/__init__.py` [inbound_imports=85, lines=57]
- `metagpt/config2.py` [inbound_imports=62, lines=182]
- `metagpt/roles/__init__.py` [inbound_imports=40, lines=34]
- `metagpt/actions/action_node.py` [inbound_imports=36, lines=876]
- `metagpt/tools/tool_registry.py` [inbound_imports=34, lines=194]
- `metagpt/llm.py` [inbound_imports=33, lines=20]

## Manifests

- `analysis/manifests/file_inventory.jsonl` -> one record per scanned file with kind, size, lines, symbols, and primary batch.
- `analysis/manifests/import_graph.jsonl` -> import edges for Python files with internal vs external classification.
- `analysis/manifests/feature_catalog.jsonl` -> shortlist of reusable features with reuse score and coupling.
- `analysis/manifests/domain_map.json` -> batch assignment for every scanned file plus coverage counts.
- `analysis/manifests/system_summary.json` -> repo-wide counts, entrypoints, hubs, and batch stats.

## Recommended deep-dive order

1. `B01-core-runtime-config`
2. `B02-agent-orchestration`
3. `B03-actions-planning-prompts`
4. `B04-llm-provider-layer`
5. `B05-tools-utils-execution`
6. `B06-rag-doc-knowledge`
7. `B07-environments-extensions`
8. `B08-tests-examples-docs-infra`

## Notes

- This map is code-first. Docs and README files are indexed, but architectural claims were anchored in `metagpt/*` and the executable surfaces.
- `pytest.ini` ignores many expensive integration paths; treat that file as part of the risk map when choosing what to trust as well-covered.