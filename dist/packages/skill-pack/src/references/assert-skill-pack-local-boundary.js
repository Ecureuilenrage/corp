"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.assertSkillPackLocalBoundary = assertSkillPackLocalBoundary;
const node_path_1 = __importDefault(require("node:path"));
function assertSkillPackLocalBoundary(options) {
    const rootDir = node_path_1.default.resolve(options.localRefs.rootDir);
    for (const [index, referencePath] of options.localRefs.references.entries()) {
        assertPathWithinSkillPackRoot(rootDir, node_path_1.default.resolve(referencePath), options.packRef, `references[${index}]`);
    }
    if (options.localRefs.metadataFile) {
        assertPathWithinSkillPackRoot(rootDir, node_path_1.default.resolve(options.localRefs.metadataFile), options.packRef, "metadataFile");
    }
    for (const [index, scriptPath] of options.localRefs.scripts.entries()) {
        assertPathWithinSkillPackRoot(rootDir, node_path_1.default.resolve(scriptPath), options.packRef, `scripts[${index}]`);
    }
}
function assertPathWithinSkillPackRoot(rootDir, candidatePath, packRef, label) {
    const relativePath = node_path_1.default.relative(rootDir, candidatePath);
    const staysWithinRoot = relativePath === ""
        || (!relativePath.startsWith("..") && !node_path_1.default.isAbsolute(relativePath));
    if (staysWithinRoot) {
        return;
    }
    throw new Error(`Le skill pack \`${packRef}\` sort de sa frontiere locale pour \`${label}\`: ${candidatePath}.`);
}
