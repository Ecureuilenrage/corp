"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedProjectionStore = seedProjectionStore;
exports.resolveProjectionPath = resolveProjectionPath;
exports.readProjectionFile = readProjectionFile;
exports.readProjectionSnapshot = readProjectionSnapshot;
exports.writeProjectionSnapshot = writeProjectionSnapshot;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
async function seedProjectionStore(projectionsDir, projections) {
    const createdPaths = [];
    for (const [projectionName, snapshot] of Object.entries(projections)) {
        const projectionPath = node_path_1.default.join(projectionsDir, `${projectionName}.json`);
        const created = await writeFileIfMissing(projectionPath, `${JSON.stringify(snapshot, null, 2)}\n`);
        if (created) {
            createdPaths.push(projectionPath);
        }
    }
    return { createdPaths };
}
function resolveProjectionPath(projectionsDir, projectionName) {
    return node_path_1.default.join(projectionsDir, `${projectionName}.json`);
}
async function readProjectionFile(projectionsDir, projectionName) {
    const projectionPath = resolveProjectionPath(projectionsDir, projectionName);
    return (0, promises_1.readFile)(projectionPath, "utf8");
}
async function readProjectionSnapshot(projectionsDir, projectionName) {
    return JSON.parse(await readProjectionFile(projectionsDir, projectionName));
}
async function writeProjectionSnapshot(projectionsDir, projectionName, snapshot) {
    const projectionPath = resolveProjectionPath(projectionsDir, projectionName);
    await (0, promises_1.writeFile)(projectionPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
    return projectionPath;
}
async function writeFileIfMissing(filePath, contents) {
    try {
        await (0, promises_1.access)(filePath);
        return false;
    }
    catch {
        await (0, promises_1.writeFile)(filePath, contents, "utf8");
        return true;
    }
}
