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
const atomic_json_1 = require("../../packages/storage/src/fs-layout/atomic-json");
// On reutilise le meme objet module que celui resolu par atomic-json.ts : en CJS,
// `require` retourne l'instance cachee, ce qui permet a t.mock.method de substituer
// la methode effectivement appelee depuis renameWithTransientRetry.
const fsPromises = require("node:fs/promises");
(0, node_test_1.default)("writeJsonAtomic ecrit un JSON formate via un fichier temporaire", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-write-json-atomic-success-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const targetPath = node_path_1.default.join(rootDir, "snapshot.json");
    await (0, atomic_json_1.writeJsonAtomic)(targetPath, { answer: 42, nested: { ok: true } });
    strict_1.default.equal(await (0, promises_1.readFile)(targetPath, "utf8"), `${JSON.stringify({ answer: 42, nested: { ok: true } }, null, 2)}\n`);
});
(0, node_test_1.default)("writeJsonAtomic nettoie le temporaire et laisse la cible intacte si rename echoue", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-write-json-atomic-rename-fail-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const targetPath = node_path_1.default.join(rootDir, "snapshot.json");
    const targetMarkerPath = node_path_1.default.join(targetPath, "marker.txt");
    const temporaryPath = `${targetPath}.tmp`;
    await (0, promises_1.mkdir)(targetPath);
    await (0, promises_1.writeFile)(targetMarkerPath, "target-still-here", "utf8");
    await strict_1.default.rejects(() => (0, atomic_json_1.writeJsonAtomic)(targetPath, { next: true }));
    strict_1.default.equal(await (0, promises_1.readFile)(targetMarkerPath, "utf8"), "target-still-here");
    await strict_1.default.rejects(() => (0, promises_1.readFile)(temporaryPath, "utf8"), /ENOENT/);
});
(0, node_test_1.default)("writeJsonAtomic nettoie le fallback UUID si rename echoue et ne laisse aucun orphelin", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-write-json-atomic-uuid-fallback-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const targetPath = node_path_1.default.join(rootDir, "snapshot.json");
    const preferredTemporaryPath = `${targetPath}.tmp`;
    await (0, promises_1.mkdir)(targetPath);
    await (0, promises_1.writeFile)(node_path_1.default.join(targetPath, "marker.txt"), "target-is-a-dir", "utf8");
    await (0, promises_1.writeFile)(preferredTemporaryPath, "contention", "utf8");
    await strict_1.default.rejects(() => (0, atomic_json_1.writeJsonAtomic)(targetPath, { fallback: true }));
    const residualEntries = await (0, promises_1.readdir)(rootDir);
    const residualTmp = residualEntries.filter((entry) => entry.endsWith(".tmp") && entry !== "snapshot.json.tmp");
    strict_1.default.equal(residualTmp.length, 0, `Un temporaire UUID a ete laisse orphelin: ${residualTmp.join(", ")}`);
    strict_1.default.equal(await (0, promises_1.readFile)(node_path_1.default.join(targetPath, "marker.txt"), "utf8"), "target-is-a-dir");
    strict_1.default.equal(await (0, promises_1.readFile)(preferredTemporaryPath, "utf8"), "contention");
});
(0, node_test_1.default)("writeJsonAtomic recupere d'un rename transient EPERM apres deux retries", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-write-json-atomic-eperm-retry-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const targetPath = node_path_1.default.join(rootDir, "snapshot.json");
    const originalRename = fsPromises.rename;
    let attempts = 0;
    t.mock.method(fsPromises, "rename", async (src, dst) => {
        attempts += 1;
        if (attempts <= 2) {
            throw Object.assign(new Error("EPERM simule (transient)"), { code: "EPERM" });
        }
        return originalRename(src, dst);
    });
    await (0, atomic_json_1.writeJsonAtomic)(targetPath, { retry: "ok", attempt: 3 });
    strict_1.default.equal(attempts, 3);
    strict_1.default.equal(await (0, promises_1.readFile)(targetPath, "utf8"), `${JSON.stringify({ retry: "ok", attempt: 3 }, null, 2)}\n`);
    // Aucun .tmp residuel.
    const residualEntries = await (0, promises_1.readdir)(rootDir);
    strict_1.default.deepEqual(residualEntries.sort(), ["snapshot.json"]);
});
(0, node_test_1.default)("writeJsonAtomic nettoie le temporaire et propage l'erreur apres epuisement du budget retry", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-write-json-atomic-eperm-exhausted-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const targetPath = node_path_1.default.join(rootDir, "snapshot.json");
    let attempts = 0;
    t.mock.method(fsPromises, "rename", async () => {
        attempts += 1;
        throw Object.assign(new Error("EPERM simule (persistant)"), { code: "EPERM" });
    });
    await strict_1.default.rejects(() => (0, atomic_json_1.writeJsonAtomic)(targetPath, { retry: "ko" }), (error) => typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "EPERM");
    // Le retry boucle est borne a 10 attempts dans renameWithTransientRetry.
    strict_1.default.equal(attempts, 10);
    const residualEntries = await (0, promises_1.readdir)(rootDir);
    strict_1.default.deepEqual(residualEntries, []);
});
(0, node_test_1.default)("writeJsonAtomic supporte 10 ecritures concurrentes sans JSON tronque", async (t) => {
    const rootDir = await (0, promises_1.mkdtemp)(node_path_1.default.join((0, node_os_1.tmpdir)(), "corp-write-json-atomic-concurrent-"));
    t.after(async () => {
        await (0, promises_1.rm)(rootDir, { recursive: true, force: true });
    });
    const targetPath = node_path_1.default.join(rootDir, "projection.json");
    await Promise.all(Array.from({ length: 10 }, (_, index) => (0, atomic_json_1.writeJsonAtomic)(targetPath, {
        schemaVersion: 1,
        writer: index,
        payload: `value-${index}`,
    })));
    const parsed = JSON.parse(await (0, promises_1.readFile)(targetPath, "utf8"));
    strict_1.default.equal(parsed.schemaVersion, 1);
    strict_1.default.equal(typeof parsed.writer, "number");
    strict_1.default.equal(typeof parsed.payload, "string");
});
