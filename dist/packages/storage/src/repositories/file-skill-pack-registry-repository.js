"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSkillPackRegistryRepository = void 0;
exports.createFileSkillPackRegistryRepository = createFileSkillPackRegistryRepository;
const promises_1 = require("node:fs/promises");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
class FileSkillPackRegistryRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(registeredSkillPack) {
        const skillPackStoragePaths = (0, workspace_layout_1.resolveSkillPackStoragePaths)(this.layout, registeredSkillPack.packRef);
        const existingSkillPack = await this.findByPackRef(registeredSkillPack.packRef);
        if (existingSkillPack) {
            if ((0, structural_compare_1.deepStrictEqualForComparison)(toComparableRegisteredSkillPack(existingSkillPack), toComparableRegisteredSkillPack(registeredSkillPack))) {
                return {
                    status: "unchanged",
                    skillPackDir: skillPackStoragePaths.skillPackDir,
                    skillPackPath: skillPackStoragePaths.skillPackPath,
                    registeredSkillPack: existingSkillPack,
                };
            }
            throw new Error(`Collision ambigue pour le skill pack \`${registeredSkillPack.packRef}\`: une autre registration existe deja.`);
        }
        await (0, promises_1.mkdir)(this.layout.skillPacksDir, { recursive: true });
        try {
            await (0, promises_1.mkdir)(skillPackStoragePaths.skillPackDir);
        }
        catch (error) {
            if (isAlreadyExistsError(error)) {
                throw new Error(`Enregistrement concurrent detecte pour le skill pack \`${registeredSkillPack.packRef}\`.`);
            }
            throw error;
        }
        const temporarySkillPackPath = `${skillPackStoragePaths.skillPackPath}.tmp`;
        try {
            await (0, promises_1.writeFile)(temporarySkillPackPath, `${JSON.stringify(registeredSkillPack, null, 2)}\n`, "utf8");
            await (0, promises_1.rename)(temporarySkillPackPath, skillPackStoragePaths.skillPackPath);
        }
        catch (error) {
            try {
                await cleanupTemporarySkillPackFile(temporarySkillPackPath);
            }
            catch {
                // Best-effort cleanup du fichier temporaire.
            }
            try {
                await (0, promises_1.rm)(skillPackStoragePaths.skillPackDir, { recursive: true, force: true });
            }
            catch {
                // Best-effort cleanup du repertoire orphelin.
            }
            throw error;
        }
        return {
            status: "registered",
            skillPackDir: skillPackStoragePaths.skillPackDir,
            skillPackPath: skillPackStoragePaths.skillPackPath,
            registeredSkillPack,
        };
    }
    async findByPackRef(packRef) {
        const skillPackStoragePaths = (0, workspace_layout_1.resolveSkillPackStoragePaths)(this.layout, packRef);
        try {
            const storedSkillPack = await (0, promises_1.readFile)(skillPackStoragePaths.skillPackPath, "utf8");
            return JSON.parse(storedSkillPack);
        }
        catch (error) {
            if (isMissingFileError(error)) {
                return null;
            }
            if (error instanceof SyntaxError) {
                throw new Error(`Fichier de registre corrompu pour le skill pack \`${packRef}\`.`);
            }
            throw error;
        }
    }
    async list() {
        const skillPackEntries = await readDirectoryEntries(this.layout.skillPacksDir);
        const skillPacks = [];
        for (const skillPackEntry of skillPackEntries) {
            if (!skillPackEntry.isDirectory()) {
                continue;
            }
            try {
                const skillPack = await this.findByPackRef(skillPackEntry.name);
                if (skillPack) {
                    skillPacks.push(skillPack);
                }
            }
            catch {
                continue;
            }
        }
        return skillPacks.sort((left, right) => left.packRef.localeCompare(right.packRef));
    }
}
exports.FileSkillPackRegistryRepository = FileSkillPackRegistryRepository;
function createFileSkillPackRegistryRepository(layout) {
    return new FileSkillPackRegistryRepository(layout);
}
function toComparableRegisteredSkillPack(registeredSkillPack) {
    const { registeredAt: _registeredAt, ...comparableSkillPack } = registeredSkillPack;
    return comparableSkillPack;
}
async function readDirectoryEntries(directoryPath) {
    try {
        return await (0, promises_1.readdir)(directoryPath, { withFileTypes: true, encoding: "utf8" });
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return [];
        }
        throw error;
    }
}
function isMissingFileError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "ENOENT";
}
function isAlreadyExistsError(error) {
    return typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "EEXIST";
}
async function cleanupTemporarySkillPackFile(filePath) {
    try {
        await (0, promises_1.unlink)(filePath);
    }
    catch (error) {
        if (isMissingFileError(error)) {
            return;
        }
        throw error;
    }
}
