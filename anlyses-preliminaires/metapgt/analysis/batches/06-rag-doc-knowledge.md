# RAG / Document Store / Experience / Repo Parsing

Batch ID: `B06-rag-doc-knowledge`

## purpose
Knowledge-retrieval stack: document ingestion, retriever/index factories, experience caching, document models, and codebase structure parsing.

This batch is useful for extraction, but only if you split it correctly. `BaseStore` and `RepoParser` are small and portable. `SimpleEngine` and `ExperienceManager` are valuable but pull in the full LlamaIndex-shaped surface.

## subdomains
- `simple rag composition`
  - `metagpt/rag/engines/simple.py::SimpleEngine`
- `retriever / index factories`
  - `metagpt/rag/factories/retriever.py::RetrieverFactory`
  - `metagpt/rag/schema.py::*`
- `experience cache`
  - `metagpt/exp_pool/decorator.py::{exp_cache,ExpCacheHandler}`
  - `metagpt/exp_pool/manager.py::ExperienceManager`
  - `metagpt/exp_pool/schema.py::*`
- `document models`
  - `metagpt/document.py::{Document,IndexableDocument,Repo,RepoMetadata}`
- `repo structure extraction`
  - `metagpt/repo_parser.py::RepoParser`
- `store contracts`
  - `metagpt/document_store/base_store.py::{BaseStore,LocalStore}`

## entrypoints
- `metagpt/rag/engines/simple.py::SimpleEngine.from_docs`
- `metagpt/rag/engines/simple.py::SimpleEngine.from_objs`
- `metagpt/rag/engines/simple.py::SimpleEngine.from_index`
- `metagpt/rag/factories/retriever.py::get_retriever`
- `metagpt/exp_pool/decorator.py::exp_cache`
- `metagpt/exp_pool/manager.py::get_exp_manager`
- `metagpt/document.py::IndexableDocument.from_path`
- `metagpt/repo_parser.py::RepoParser.generate_symbols`
- `metagpt/repo_parser.py::RepoParser.rebuild_class_views`

## key files
- `metagpt/rag/engines/simple.py` [411 lines, inbound_imports=3]
  - main composition shell for docs/objects -> nodes -> retrievers -> rankers -> querying
- `metagpt/rag/factories/retriever.py` [157 lines, inbound_imports=2]
  - config-to-retriever assembly for BM25 / FAISS / Chroma / Elasticsearch
- `metagpt/exp_pool/decorator.py` [227 lines, inbound_imports=2]
  - cache decorator and handler lifecycle
- `metagpt/exp_pool/manager.py` [242 lines, inbound_imports=4]
  - create/query/delete experience entries through RAG storage
- `metagpt/document.py` [235 lines, inbound_imports=3]
  - generic documents, indexable documents, repo container
- `metagpt/repo_parser.py` [1023 lines, inbound_imports=7]
  - AST symbol extraction plus `pyreverse`-backed class-view reconstruction
- `metagpt/document_store/base_store.py` [52 lines, inbound_imports=4]
  - minimal store lifecycle contracts
- `metagpt/rag/schema.py` [274 lines, inbound_imports=23]
  - config objects for retrievers, rankers, indexes, and omniparse results
- `metagpt/exp_pool/schema.py` [76 lines, inbound_imports=15]
  - experience metadata and scoring types

## data flow
- `SimpleEngine.from_docs()` loads files, transforms them into nodes, builds retrievers/rankers, then exposes retrieval/query APIs.
- `SimpleEngine.from_objs()` wraps arbitrary `RAGObject` instances in `ObjectNode` metadata so retrieved nodes can reconstruct original objects.
- `RetrieverFactory.get_retriever()` turns retriever config objects into a single retriever or a `SimpleHybridRetriever`.
- `exp_cache()` builds request context, fetches experiences, short-circuits on a perfect match, otherwise executes the function and writes a scored experience.
- `ExperienceManager` uses `SimpleEngine` as its storage layer.
- `RepoParser` uses AST parsing for symbol maps and shells out to `pyreverse` for class/relationship reconstruction.

## feature inventory
- `SimpleEngine composition shell`
  - kind: `core runtime`
  - files: `metagpt/rag/engines/simple.py`
  - symbols: `SimpleEngine.from_docs`, `SimpleEngine.from_objs`, `SimpleEngine.from_index`, `SimpleEngine.retrieve`, `SimpleEngine.aretrieve`, `SimpleEngine.add_docs`, `SimpleEngine.add_objs`, `SimpleEngine.persist`, `SimpleEngine.delete_docs`
  - reuse: `copiable avec adaptation`
- `RetrieverFactory core`
  - kind: `provider adapter`
  - files: `metagpt/rag/factories/retriever.py`
  - symbols: `get_or_build_index`, `RetrieverFactory.get_retriever`, `_create_faiss_retriever`, `_create_bm25_retriever`, `_create_chroma_retriever`, `_create_es_retriever`
  - reuse: `copiable avec adaptation`
- `Experience cache decorator`
  - kind: `core runtime`
  - files: `metagpt/exp_pool/decorator.py`
  - symbols: `exp_cache`, `ExpCacheHandler.fetch_experiences`, `ExpCacheHandler.get_one_perfect_exp`, `ExpCacheHandler.execute_function`, `ExpCacheHandler.process_experience`, `ExpCacheHandler.choose_wrapper`
  - reuse: `copiable avec adaptation`
- `Experience manager`
  - kind: `glue runtime`
  - files: `metagpt/exp_pool/manager.py`
  - symbols: `ExperienceManager.create_exp`, `ExperienceManager.query_exps`, `ExperienceManager.delete_all_exps`, `_create_bm25_storage`, `_create_chroma_storage`, `_get_ranker_configs`
  - reuse: `copiable avec adaptation`
- `Document models`
  - kind: `core runtime`
  - files: `metagpt/document.py`
  - symbols: `read_data`, `Document.from_path`, `IndexableDocument.from_path`, `IndexableDocument.get_docs_and_metadatas`, `Repo.from_path`, `Repo.get_text_documents`, `Repo.eda`
  - reuse: `copiable avec adaptation`
- `RepoParser symbol extractor`
  - kind: `tool runtime`
  - files: `metagpt/repo_parser.py`
  - symbols: `RepoParser.generate_symbols`, `RepoParser.generate_structure`, `RepoParser.node_to_str`, `RepoParser.rebuild_class_views`, `_parse_classes`, `_parse_class_relationships`
  - reuse: `copiable avec adaptation`
- `Store contracts`
  - kind: `core runtime`
  - files: `metagpt/document_store/base_store.py`
  - symbols: `BaseStore.search`, `BaseStore.write`, `BaseStore.add`, `LocalStore._load`, `LocalStore._write`
  - reuse: `copiable tel quel`

## symbol map
- rag engine
  - `metagpt/rag/engines/simple.py::{SimpleEngine,from_docs,from_objs,from_index,retrieve,aretrieve,add_docs,add_objs,persist,count,clear,delete_docs,get_obj_nodes}`
- retriever factory
  - `metagpt/rag/factories/retriever.py::{get_or_build_index,RetrieverFactory,get_retriever}`
- experience pool
  - `metagpt/exp_pool/decorator.py::{exp_cache,ExpCacheHandler}`
  - `metagpt/exp_pool/manager.py::{ExperienceManager,get_exp_manager}`
  - `metagpt/exp_pool/schema.py::{QueryType,ExperienceType,EntryType,Score,Metric,Trajectory,Experience}`
- docs + repo structure
  - `metagpt/document.py::{DocumentStatus,Document,IndexableDocument,RepoMetadata,Repo}`
  - `metagpt/repo_parser.py::{RepoFileInfo,CodeBlockInfo,DotClassAttribute,DotClassInfo,DotClassRelationship,DotReturn,DotClassMethod,RepoParser}`
- store base
  - `metagpt/document_store/base_store.py::{BaseStore,LocalStore}`

## dependency map
- import pressure by batch from B06 code
  - `B06-rag-doc-knowledge`: `82`
  - `B01-core-runtime-config`: `25`
  - `B05-tools-utils-execution`: `14`
  - `B03-actions-planning-prompts`: `3`
  - `B04-llm-provider-layer`: `2`
- hard blockers for extracting `SimpleEngine`
  - `llama_index`
  - `fsspec`
  - `metagpt/rag/factories/*`
  - `metagpt/rag/schema.py`
- hard blockers for extracting `RetrieverFactory`
  - `chromadb`
  - `faiss`
  - `llama_index.vector_stores.*`
  - retriever implementations in `metagpt/rag/retrievers/*`
- hard blockers for extracting the experience pool
  - `metagpt/config2.py`
  - `metagpt/rag/engines/simple.py`
  - `metagpt/exp_pool/context_builders/*`
  - `metagpt/exp_pool/scorers/*`
  - `metagpt/exp_pool/serializers/*`
  - `metagpt/exp_pool/perfect_judges/*`
- hard blockers for extracting `RepoParser`
  - `pandas`
  - `pyreverse` / pylint installation for `rebuild_class_views`
  - `metagpt/utils/common.py`

## extraction recipes
- extract only store interfaces
  - read first: `metagpt/document_store/base_store.py`
  - keep: whole file
  - advice: `copiable tel quel`
- extract repo structure parsing
  - read first: `metagpt/repo_parser.py`
  - keep: `generate_symbols` and AST helpers first
  - add later only if needed: `rebuild_class_views()` and dot parsing
  - advice: `copiable avec adaptation`
- extract retriever factory without MetaGPT engine
  - read first: `metagpt/rag/factories/retriever.py`, `metagpt/rag/schema.py`
  - keep: config-to-retriever selection logic
  - replace: MetaGPT retriever subclasses if you already have your own index wrappers
  - advice: `copiable avec adaptation`
- extract experience cache
  - read first: `metagpt/exp_pool/decorator.py`
  - keep: decorator protocol, handler lifecycle, perfect-match shortcut
  - replace: storage manager, serializer, scorer, and context builder
  - advice: `copiable avec adaptation`
- extract a lightweight RAG engine
  - read first: `metagpt/rag/engines/simple.py`
  - keep: `from_docs` / `from_objs` / retrieval API
  - drop first: object reconstruction and omniparse if you do not need them
  - advice: `copiable avec adaptation`

## do not copy blindly
- `metagpt/rag/engines/simple.py` defines `_from_nodes` twice with the same body. It works, but it is a code-drift signal that should be cleaned up in an extraction.
- `SimpleEngine` only supports `add_docs`, `persist`, `clear`, or `delete_docs` when the underlying retriever implements the matching extra interfaces.
- `SimpleEngine._get_file_extractor()` conditionally injects OmniParse for PDFs based on global config, which is a hidden runtime branch.
- `ExpCacheHandler` requires a keyword argument named `req`; missing it raises immediately.
- `ExperienceManager` wraps most operations with `handle_exception`, so write/query failures can be swallowed and look like empty caches.
- `metagpt/document.py::Document` shares a name with `llama_index.core.Document`; be explicit in an extraction to avoid collisions.
- `RepoParser.rebuild_class_views()` requires a valid Python package layout with `__init__.py` and an installed `pyreverse`.

## minimal reusable slices
- `BaseStore contracts`
  - files: `metagpt/document_store/base_store.py`
  - verdict: `copiable tel quel`
- `RepoParser symbol extractor`
  - files: `metagpt/repo_parser.py`
  - keep first: `generate_symbols`, `node_to_str`, AST helpers
  - verdict: `copiable avec adaptation`
- `RetrieverFactory core`
  - files: `metagpt/rag/factories/retriever.py`, `metagpt/rag/schema.py`
  - verdict: `copiable avec adaptation`
- `Experience cache handler`
  - files: `metagpt/exp_pool/decorator.py`
  - verdict: `copiable avec adaptation`
- `SimpleEngine shell`
  - files: `metagpt/rag/engines/simple.py`
  - verdict: `copiable avec adaptation`

## executable docs / tests
- `examples/rag/rag_search.py`
- `examples/rag/rag_pipeline.py`
- `examples/rag/rag_bm.py`
- `examples/rag/omniparse.py`
- `tests/metagpt/rag/engines/test_simple.py`
- `tests/metagpt/rag/factories/test_retriever.py`
- `tests/metagpt/exp_pool/test_decorator.py`
- `tests/metagpt/test_repo_parser.py`
- `tests/metagpt/test_document.py`

Many of these are skipped in the default `pytest.ini` run, but they are the fastest way to verify extraction boundaries.

## external deps
- rag stack
  - `llama-index`
  - `chromadb`
  - `faiss`
  - `elasticsearch`
  - `cohere` / reranker extras
- document parsing
  - `pandas`
  - `docx2txt`
  - `pdf` readers

## flags/env
- `config.exp_pool.*`
- `config.omniparse.*`
- retriever configs in `metagpt/rag/schema.py`
- store `persist_path` and `collection_name`

## exact search shortcuts
- `rg -n "class (SimpleEngine|RetrieverFactory|ExpCacheHandler|ExperienceManager|RepoParser|BaseStore|LocalStore)" metagpt/rag metagpt/exp_pool metagpt`
- `rg -n "def (from_docs|from_objs|from_index|get_retriever|exp_cache|query_exps|generate_symbols|rebuild_class_views)" metagpt/rag metagpt/exp_pool metagpt`
- `rg -n "RetrieverConfig|RankerConfig|IndexConfig|OmniParse" metagpt/rag/schema.py`

## hubs
- `metagpt/rag/schema.py` [inbound_imports=23]
- `metagpt/exp_pool/schema.py` [inbound_imports=15]
- `metagpt/rag/engines/__init__.py` [inbound_imports=13]
- `metagpt/repo_parser.py` [inbound_imports=7]
