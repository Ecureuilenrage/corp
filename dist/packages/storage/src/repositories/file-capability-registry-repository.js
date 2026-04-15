"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileCapabilityRegistryRepository = void 0;
exports.createFileCapabilityRegistryRepository = createFileCapabilityRegistryRepository;
const promises_1 = require("node:fs/promises");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
const atomic_json_1 = require("../fs-layout/atomic-json");
const file_system_read_errors_1 = require("../fs-layout/file-system-read-errors");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const persisted_document_errors_1 = require("./persisted-document-errors");
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
            if ((0, atomic_json_1.isAlreadyExistsError)(error)) {
                throw new Error(`Enregistrement concurrent detecte pour la capability \`${registeredCapability.capabilityId}\`.`);
            }
            throw error;
        }
        await (0, atomic_json_1.writeJsonAtomic)(capabilityStoragePaths.capabilityPath, registeredCapability);
        return {
            status: "registered",
            capabilityDir: capabilityStoragePaths.capabilityDir,
            capabilityPath: capabilityStoragePaths.capabilityPath,
            registeredCapability,
        };
    }
    async findByCapabilityId(capabilityId) {
        const capabilityStoragePaths = (0, workspace_layout_1.resolveCapabilityStoragePaths)(this.layout, capabilityId);
        const context = {
            filePath: capabilityStoragePaths.capabilityPath,
            entityLabel: "RegisteredCapability",
            corruptionLabel: "fichier de registre corrompu pour la capability",
            documentId: capabilityId,
        };
        try {
            const storedCapability = await (0, persisted_document_errors_1.readPersistedJsonDocument)(context);
            (0, persisted_document_errors_1.assertValidPersistedDocument)(storedCapability, persisted_document_guards_1.validateRegisteredCapability, context);
            return storedCapability;
        }
        catch (error) {
            if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
                return null;
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
        if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
            return [];
        }
        throw error;
    }
}
