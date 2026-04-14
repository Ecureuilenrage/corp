"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCapabilityRegistryRepository = void 0;
exports.createFileCapabilityRegistryRepository = createFileCapabilityRegistryRepository;
const promises_1 = require("node:fs/promises");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
class FileCapabilityRegistryRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(registeredCapability) {
        const capabilityStoragePaths = (0, workspace_layout_1.resolveCapabilityStoragePaths)(this.layout, registeredCapability.capabilityId);
        const existingCapability = await this.findByCapabilityId(registeredCapability.capabilityId);
        if (existingCapability) {
            if ((0, structural_compare_1.deepStrictEqualForComparison)(toComparableRegisteredCapability(existingCapability), toComparableRegisteredCapability(registeredCapability))) {
                return {
                    status: "unchanged",
                    capabilityDir: capabilityStoragePaths.capabilityDir,
                    capabilityPath: capabilityStoragePaths.capabilityPath,
                    registeredCapability: existingCapability,
                };
            }
            throw new Error(`Collision ambigue pour la capability \`${registeredCapability.capabilityId}\`: une autre registration existe deja.`);
        }
        await (0, promises_1.mkdir)(this.layout.capabilitiesDir, { recursive: true });
        try {
            await (0, promises_1.mkdir)(capabilityStoragePaths.capabilityDir);
        }
        catch (error) {
            if (isAlreadyExistsError(error)) {
                throw new Error(`Enregistrement concurrent detecte pour la capability \`${registeredCapability.capabilityId}\`.`);
            }
            throw error;
        }
        const temporaryCapabilityPath = `${capabilityStoragePaths.capabilityPath}.tmp`;
        try {
            // Best-effort V1: claim the directory, then write a temp file and rename it to avoid
            // partially written registry entries without introducing a full lock manager.
            await (0, promises_1.writeFile)(temporaryCapabilityPath, `${JSON.stringify(registeredCapability, null, 2)}\n`, "utf8");
            await (0, promises_1.rename)(temporaryCapabilityPath, capabilityStoragePaths.capabilityPath);
        }
        catch (error) {
            try {
                await cleanupTemporaryCapabilityFile(temporaryCapabilityPath);
            }
            catch {
                // Best-effort cleanup: the original write/rename error is more important.
            }
            throw error;
        }
        return {
            status: "registered",
            capabilityDir: capabilityStoragePaths.capabilityDir,
            capabilityPath: capabilityStoragePaths.capabilityPath,
            registeredCapability,
        };
    }
    async findByCapabilityId(capabilityId) {
        const capabilityStoragePaths = (0, workspace_layout_1.resolveCapabilityStoragePaths)(this.layout, capabilityId);
        try {
            const storedCapability = await (0, promises_1.readFile)(capabilityStoragePaths.capabilityPath, "utf8");
            return JSON.parse(storedCapability);
        }
        catch (error) {
            if (isMissingFileError(error)) {
                return null;
            }
            if (error instanceof SyntaxError) {
                throw new Error(`Fichier de registre corrompu pour la capability \`${capabilityId}\`.`);
            }
            throw error;
        }
    }
    async list() {
        const capabilityEntries = await readDirectoryEntries(this.layout.capabilitiesDir);
        const capabilities = [];
        for (const capabilityEntry of capabilityEntries) {
            if (!capabilityEntry.isDirectory()) {
                continue;
            }
            const capability = await this.findByCapabilityId(capabilityEntry.name);
            if (capability) {
                capabilities.push(capability);
            }
        }
        return capabilities.sort((left, right) => left.capabilityId.localeCompare(right.capabilityId));
    }
}
exports.FileCapabilityRegistryRepository = FileCapabilityRegistryRepository;
function createFileCapabilityRegistryRepository(layout) {
    return new FileCapabilityRegistryRepository(layout);
}
function toComparableRegisteredCapability(registeredCapability) {
    const { registeredAt: _registeredAt, ...comparableCapability } = registeredCapability;
    return comparableCapability;
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
async function cleanupTemporaryCapabilityFile(filePath) {
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
