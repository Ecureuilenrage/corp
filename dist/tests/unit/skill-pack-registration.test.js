"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_os_1 = require("node:os");
const node_test_1 = __importDefault(require("node:test"));
const register_skill_pack_1 = require("../../packages/skill-pack/src/loader/register-skill-pack");
const resolve_ticket_skill_packs_1 = require("../../packages/skill-pack/src/loader/resolve-ticket-skill-packs");
const workspace_layout_1 = require("../../packages/storage/src/fs-layout/workspace-layout");
const file_skill_pack_registry_repository_1 = require("../../packages/storage/src/repositories/file-skill-pack-registry-repository");
function getFixtureRoot() {
    return node_path_1.default.join(process.cwd(), "tests", "fixtures", "extensions");
}
function getFixturePath(fileName) {
    return node_path_1.default.join(getFixtureRoot(), fileName);
}
function createMission(overrides = {}) {
    return {
        id: "mission_skill_pack",
        title: "Mission skill pack",
        objective: "Verifier le chargement metadata-first d'un skill pack",
        status: "running",
        successCriteria: ["Le pack est resolu sans charger son contenu"],
        policyProfileId: "policy_profile_local",
        authorizedExtensions: {
            allowedCapabilities: [],
            skillPackRefs: [],
        },
        ticketIds: ["ticket_skill_pack"],
        artifactIds: [],
        eventIds: ["event_mission_created"],
        resumeCursor: "event_mission_created",
        createdAt: "2026-04-13T20:00:00.000Z",
        updatedAt: "2026-04-13T20:00:00.000Z",
        ...overrides,
    };
}
function createTicket(overrides = {}) {
    return {
        id: "ticket_skill_pack",
        missionId: "mission_skill_pack",
        kind: "implement",
        goal: "Mobiliser un skill pack local en runtime",
        status: "claimed",
        owner: "agent_skill_pack",
        dependsOn: [],
        successCriteria: ["Le runtime recoit un resume compact du pack"],
        allowedCapabilities: [],
        skillPackRefs: ["pack.triage.local"],
        workspaceIsolationId: "iso_skill_pack",
        executionHandle: {
            adapter: "codex_responses",
            adapterState: {},
        },
        artifactIds: [],
        eventIds: ["event_ticket_created"],
        createdAt: "2026-04-13T20:00:05.000Z",
        updatedAt: "2026-04-13T20:00:05.000Z",
        ...overrides,
    };
}
(0, node_test_1.default)("registerSkillPack persiste un skill pack valide de facon idempotente", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-register-unit-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    const firstResult = await (0, register_skill_pack_1.registerSkillPack)({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-13T20:10:00.000Z",
    });
    const storedSkillPack = await repository.findByPackRef("pack.triage.local");
    const secondResult = await (0, register_skill_pack_1.registerSkillPack)({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-13T20:10:01.000Z",
    });
    strict_1.default.equal(firstResult.status, "registered");
    strict_1.default.equal(secondResult.status, "unchanged");
    strict_1.default.ok(storedSkillPack);
    strict_1.default.equal(storedSkillPack.packRef, "pack.triage.local");
    strict_1.default.equal(storedSkillPack.registrationId, "ext.skill-pack.triage.local");
    strict_1.default.equal(storedSkillPack.displayName, "Pack de triage local");
    strict_1.default.deepEqual(storedSkillPack.permissions, ["docs.read"]);
    strict_1.default.deepEqual(storedSkillPack.constraints, ["local_only", "workspace_scoped"]);
    strict_1.default.equal(storedSkillPack.localRefs.rootDir, node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack"));
    strict_1.default.deepEqual(storedSkillPack.localRefs.references, [
        node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack", "README.md"),
    ]);
    strict_1.default.equal(storedSkillPack.localRefs.metadataFile, node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack", "pack.json"));
    strict_1.default.deepEqual(storedSkillPack.localRefs.scripts, [
        node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack", "scripts", "preflight.sh"),
    ]);
    strict_1.default.doesNotMatch(JSON.stringify(storedSkillPack), /echo "preflight"|Pack de triage local\./);
    strict_1.default.equal((await repository.list()).length, 1);
});
(0, node_test_1.default)("registerSkillPack rejette un seam hors scope pour le flux skill-pack", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-wrong-seam-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    await strict_1.default.rejects(() => (0, register_skill_pack_1.registerSkillPack)({
        filePath: getFixturePath("valid-capability-local.json"),
        repository,
        registeredAt: "2026-04-13T20:15:00.000Z",
    }), /Seam non supporte.*capability/i);
});
(0, node_test_1.default)("registerSkillPack rejette une ref locale qui sort du rootDir du pack", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-boundary-"));
    const copiedFixturesDir = node_path_1.default.join(tempDir, "fixtures", "extensions");
    const workspaceRoot = node_path_1.default.join(tempDir, "workspace");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    await (0, promises_1.cp)(getFixtureRoot(), copiedFixturesDir, { recursive: true });
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "skill-packs", "outside.md"), "outside\n", "utf8");
    await (0, promises_1.writeFile)(node_path_1.default.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"), `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "skill_pack",
        id: "ext.skill-pack.outside-root",
        displayName: "Pack hors frontiere",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Fixture de test hors frontiere.",
            owner: "core-platform",
            tags: ["skill-pack", "invalid"],
        },
        localRefs: {
            rootDir: "./skill-packs/triage-pack",
            references: ["./skill-packs/triage-pack/../outside.md"],
            metadataFile: "./skill-packs/triage-pack/pack.json",
            scripts: [],
        },
        skillPack: {
            packRef: "pack.outside.root",
        },
    }, null, 2)}\n`, "utf8");
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(workspaceRoot);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    await strict_1.default.rejects(() => (0, register_skill_pack_1.registerSkillPack)({
        filePath: node_path_1.default.join(copiedFixturesDir, "invalid-skill-pack-outside-root.json"),
        repository,
        registeredAt: "2026-04-13T20:20:00.000Z",
    }), /frontiere locale/i);
    strict_1.default.equal((await repository.list()).length, 0);
});
(0, node_test_1.default)("registerSkillPack detecte une collision ambigue quand le contenu differe pour le meme packRef", async (t) => {
    const tempDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-collision-"));
    const workspaceRoot = node_path_1.default.join(tempDir, "workspace");
    t.after(async () => {
        await (0, promises_1.rm)(tempDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(workspaceRoot);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    await (0, register_skill_pack_1.registerSkillPack)({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-13T20:30:00.000Z",
    });
    const collisionManifestPath = node_path_1.default.join(tempDir, "collision-skill-pack.json");
    await (0, promises_1.writeFile)(collisionManifestPath, `${JSON.stringify({
        schemaVersion: "corp.extension.v1",
        seamType: "skill_pack",
        id: "ext.skill-pack.collision",
        displayName: "Pack collision",
        version: "0.2.0",
        permissions: ["docs.read", "docs.write"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Fixture de test collision.",
            owner: "core-platform",
            tags: ["skill-pack", "collision"],
        },
        localRefs: {
            rootDir: "./skill-packs/triage-pack",
            references: ["./skill-packs/triage-pack/README.md"],
            metadataFile: "./skill-packs/triage-pack/pack.json",
            scripts: [],
        },
        skillPack: {
            packRef: "pack.triage.local",
        },
    }, null, 2)}\n`, "utf8");
    await (0, promises_1.cp)(node_path_1.default.join(getFixtureRoot(), "skill-packs"), node_path_1.default.join(tempDir, "skill-packs"), { recursive: true });
    await strict_1.default.rejects(() => (0, register_skill_pack_1.registerSkillPack)({
        filePath: collisionManifestPath,
        repository,
        registeredAt: "2026-04-13T20:30:01.000Z",
    }), /Collision ambigue.*pack\.triage\.local/i);
    strict_1.default.equal((await repository.list()).length, 1);
});
(0, node_test_1.default)("FileSkillPackRegistryRepository traite un enregistrement concurrent identique comme unchanged", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-concurrent-identical-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    const registeredSkillPack = {
        packRef: "pack.concurrent",
        registrationId: "ext.skill-pack.concurrent",
        schemaVersion: "corp.extension.v1",
        displayName: "Pack concurrent",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Pack concurrent identique.",
            owner: "core-platform",
            tags: ["skill-pack", "concurrent"],
        },
        localRefs: {
            rootDir,
            references: [],
            scripts: [],
        },
        registeredAt: "2026-04-15T10:00:00.000Z",
        sourceManifestPath: node_path_1.default.join(rootDir, "pack.concurrent.json"),
    };
    const originalFindByPackRef = repository.findByPackRef.bind(repository);
    let synchronizedReads = 0;
    let releaseReads;
    const readBarrier = new Promise((resolve) => {
        releaseReads = resolve;
    });
    repository.findByPackRef = async (packRef) => {
        const existingSkillPack = await originalFindByPackRef(packRef);
        if (packRef === registeredSkillPack.packRef && synchronizedReads < 2) {
            synchronizedReads += 1;
            if (synchronizedReads === 2) {
                releaseReads();
            }
            await readBarrier;
        }
        return existingSkillPack;
    };
    const results = await Promise.all([
        repository.save(registeredSkillPack),
        repository.save(registeredSkillPack),
    ]);
    strict_1.default.deepEqual(results.map((result) => result.status).sort(), ["registered", "unchanged"]);
    strict_1.default.equal((await repository.list()).length, 1);
});
(0, node_test_1.default)("FileSkillPackRegistryRepository revendique une dir orpheline via creation exclusive apres expiration du polling", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-orphan-claim-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    const registeredSkillPack = {
        packRef: "pack.orphan",
        registrationId: "ext.skill-pack.orphan",
        schemaVersion: "corp.extension.v1",
        displayName: "Pack orphelin",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Simule un writer concurrent mort apres mkdir.",
            owner: "core-platform",
            tags: ["skill-pack", "orphan"],
        },
        localRefs: {
            rootDir,
            references: [],
            scripts: [],
        },
        registeredAt: "2026-04-15T11:00:00.000Z",
        sourceManifestPath: node_path_1.default.join(rootDir, "pack.orphan.json"),
    };
    // Simule un writer concurrent qui a cree la dir mais jamais le fichier (crash post-mkdir).
    await (0, promises_1.mkdir)(layout.skillPacksDir, { recursive: true });
    await (0, promises_1.mkdir)(node_path_1.default.join(layout.skillPacksDir, registeredSkillPack.packRef));
    const result = await repository.save(registeredSkillPack);
    strict_1.default.equal(result.status, "registered");
    const persisted = await repository.findByPackRef(registeredSkillPack.packRef);
    strict_1.default.ok(persisted);
    strict_1.default.equal(persisted.packRef, registeredSkillPack.packRef);
    strict_1.default.equal(persisted.displayName, "Pack orphelin");
});
(0, node_test_1.default)("FileSkillPackRegistryRepository leve un conflit legitime quand un writer concurrent publie un contenu different pendant le polling", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-concurrent-legit-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    const packRef = "pack.legit-conflict";
    const writerContent = {
        packRef,
        registrationId: "ext.skill-pack.legit-a",
        schemaVersion: "corp.extension.v1",
        displayName: "Pack A",
        version: "0.1.0",
        permissions: ["docs.read"],
        constraints: ["local_only", "workspace_scoped"],
        metadata: {
            description: "Writer concurrent.",
            owner: "core-platform",
            tags: ["skill-pack", "writer"],
        },
        localRefs: { rootDir, references: [], scripts: [] },
        registeredAt: "2026-04-15T11:30:00.000Z",
        sourceManifestPath: node_path_1.default.join(rootDir, "pack.A.json"),
    };
    const ourContent = {
        ...writerContent,
        registrationId: "ext.skill-pack.legit-b",
        displayName: "Pack B",
        version: "0.2.0",
        sourceManifestPath: node_path_1.default.join(rootDir, "pack.B.json"),
    };
    await (0, promises_1.mkdir)(layout.skillPacksDir, { recursive: true });
    // Simule un writer concurrent qui a cree la dir mais n'a pas encore publie le fichier.
    await (0, promises_1.mkdir)(node_path_1.default.join(layout.skillPacksDir, packRef));
    // Le writer concurrent publie un contenu DIFFERENT pendant le polling de notre save.
    const originalFindByPackRef = repository.findByPackRef.bind(repository);
    let pollCount = 0;
    repository.findByPackRef = async (requested) => {
        if (requested !== packRef) {
            return originalFindByPackRef(requested);
        }
        pollCount += 1;
        // Le premier appel (pre-mkdir check) trouve rien, les appels suivants (polling)
        // simulent l'arrivee du manifeste concurrent.
        if (pollCount >= 2) {
            return writerContent;
        }
        return null;
    };
    await strict_1.default.rejects(() => repository.save(ourContent), /Conflit d'ecriture concurrente legitime.*pack\.legit-conflict/i);
});
(0, node_test_1.default)("resolveTicketSkillPacks deduplique les packRefs en double dans un ticket", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-dedup-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    await (0, register_skill_pack_1.registerSkillPack)({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-13T20:35:00.000Z",
    });
    const mission = createMission();
    const summaries = await (0, resolve_ticket_skill_packs_1.resolveTicketSkillPacks)({
        repository,
        mission,
        ticket: createTicket({ skillPackRefs: ["pack.triage.local", "pack.triage.local"] }),
    });
    strict_1.default.equal(summaries.length, 1);
    strict_1.default.equal(summaries[0].packRef, "pack.triage.local");
});
(0, node_test_1.default)("resolveTicketSkillPacks retourne un resume compact et rejette les refs inconnues", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-skill-pack-resolve-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const layout = await (0, workspace_layout_1.ensureWorkspaceLayout)(rootDir);
    const repository = (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout);
    await (0, register_skill_pack_1.registerSkillPack)({
        filePath: getFixturePath("valid-skill-pack.json"),
        repository,
        registeredAt: "2026-04-13T20:25:00.000Z",
    });
    const mission = createMission();
    const summaries = await (0, resolve_ticket_skill_packs_1.resolveTicketSkillPacks)({
        repository,
        mission,
        ticket: createTicket(),
    });
    strict_1.default.deepEqual(summaries, [
        {
            packRef: "pack.triage.local",
            displayName: "Pack de triage local",
            description: "Declare un skill pack local pret a etre charge plus tard par le runtime.",
            owner: "core-platform",
            tags: ["skill-pack", "local"],
            rootDir: node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack"),
            references: [
                node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack", "README.md"),
            ],
            metadataFile: node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack", "pack.json"),
            scripts: [
                node_path_1.default.join(getFixtureRoot(), "skill-packs", "triage-pack", "scripts", "preflight.sh"),
            ],
        },
    ]);
    strict_1.default.doesNotMatch(JSON.stringify(summaries), /Pack de triage local\.|echo "preflight"/);
    const emptySummaries = await (0, resolve_ticket_skill_packs_1.resolveTicketSkillPacks)({
        repository,
        mission,
        ticket: createTicket({ skillPackRefs: [] }),
    });
    strict_1.default.deepEqual(emptySummaries, []);
    await strict_1.default.rejects(() => (0, resolve_ticket_skill_packs_1.resolveTicketSkillPacks)({
        repository,
        mission,
        ticket: createTicket({ skillPackRefs: ["pack.unknown"] }),
    }), /Skill pack introuvable.*pack\.unknown/i);
});
