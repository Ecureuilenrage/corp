"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileSkillPackRegistryRepository = void 0;
exports.createFileSkillPackRegistryRepository = createFileSkillPackRegistryRepository;
const promises_1 = require("node:fs/promises");
const persisted_document_guards_1 = require("../../../contracts/src/guards/persisted-document-guards");
const extension_registration_1 = require("../../../contracts/src/extension/extension-registration");
const structural_compare_1 = require("../../../ticket-runtime/src/utils/structural-compare");
const atomic_json_1 = require("../fs-layout/atomic-json");
const file_system_read_errors_1 = require("../fs-layout/file-system-read-errors");
const workspace_layout_1 = require("../fs-layout/workspace-layout");
const persisted_document_errors_1 = require("./persisted-document-errors");
class FileSkillPackRegistryRepository {
    layout;
    constructor(layout) {
        this.layout = layout;
    }
    async save(registeredSkillPack) {
        const skillPackStoragePaths = (0, workspace_layout_1.resolveSkillPackStoragePaths)(this.layout, registeredSkillPack.packRef);
        const existingSkillPack = await this.findByPackRef(registeredSkillPack.packRef);
        if (existingSkillPack) {
            if (hasCaseCollision(existingSkillPack.packRef, registeredSkillPack.packRef)) {
                throw new Error(`Collision de casse detectee pour le skill pack \`${registeredSkillPack.packRef}\`: deja enregistre comme \`${existingSkillPack.packRef}\`.`);
            }
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
            await (0, promises_1.mkdir)(skillPackStoragePaths.skillPackDir, { recursive: false });
        }
        catch (error) {
            if ((0, atomic_json_1.isAlreadyExistsError)(error)) {
                return await resolveConcurrentSkillPackRegistration(this, skillPackStoragePaths, registeredSkillPack);
            }
            throw error;
        }
        try {
            await (0, atomic_json_1.writeJsonAtomic)(skillPackStoragePaths.skillPackPath, registeredSkillPack);
        }
        catch (error) {
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
        const context = {
            filePath: skillPackStoragePaths.skillPackPath,
            entityLabel: "RegisteredSkillPack",
            corruptionLabel: "fichier de registre corrompu pour le skill pack",
            documentId: packRef,
        };
        try {
            const storedSkillPack = await (0, persisted_document_errors_1.readPersistedJsonDocument)(context);
            (0, persisted_document_errors_1.assertValidPersistedDocument)(storedSkillPack, persisted_document_guards_1.validateRegisteredSkillPack, context);
            return storedSkillPack;
        }
        catch (error) {
            if ((0, file_system_read_errors_1.isMissingFileError)(error)) {
                return null;
            }
            throw error;
        }
    }
    async listAll() {
        const skillPackEntries = await readDirectoryEntries(this.layout.skillPacksDir);
        const valid = [];
        const invalid = [];
        for (const skillPackEntry of skillPackEntries) {
            if (!skillPackEntry.isDirectory()) {
                continue;
            }
            try {
                const skillPack = await this.findByPackRef(skillPackEntry.name);
                if (skillPack) {
                    valid.push(skillPack);
                }
            }
            catch (error) {
                if (!(0, persisted_document_errors_1.isPersistedDocumentReadError)(error)) {
                    throw error;
                }
                invalid.push({
                    packRef: skillPackEntry.name,
                    filePath: error.filePath,
                    code: error.code,
                    message: error.message,
                    error,
                });
            }
        }
        return {
            valid: valid.sort((left, right) => left.packRef.localeCompare(right.packRef)),
            invalid: invalid.sort((left, right) => left.packRef.localeCompare(right.packRef)),
        };
    }
    async list() {
        // Deprecated: utilisez `listAll()` pour obtenir les diagnostics multi-pack
        // sans masquer les enregistrements valides.
        const result = await this.listAll();
        if (result.invalid.length > 0) {
            throw result.invalid[0].error;
        }
        return result.valid;
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
function hasCaseCollision(existingValue, requestedValue) {
    return existingValue !== requestedValue
        && (0, extension_registration_1.normalizeOpaqueReferenceKey)(existingValue)
            === (0, extension_registration_1.normalizeOpaqueReferenceKey)(requestedValue);
}
async function resolveConcurrentSkillPackRegistration(repository, skillPackStoragePaths, registeredSkillPack) {
    const existingSkillPack = await waitForConcurrentSkillPackWrite(repository, registeredSkillPack.packRef);
    if (existingSkillPack) {
        return resolveAgainstExistingRegistration(skillPackStoragePaths, registeredSkillPack, existingSkillPack);
    }
    // La fenetre de polling est expiree sans qu'un writer concurrent n'ait publie le
    // manifeste : soit le processus gagnant est mort apres mkdir, soit il est toujours
    // en vol mais au-dela du budget. On tente un claim atomique du manifeste cible avec
    // flag wx ; un rename atomique classique pourrait remplacer un manifeste concurrent
    // arrive entre la fin du polling et le claim.
    try {
        await writeRegisteredSkillPackIfMissing(skillPackStoragePaths.skillPackPath, registeredSkillPack);
        return {
            status: "registered",
            skillPackDir: skillPackStoragePaths.skillPackDir,
            skillPackPath: skillPackStoragePaths.skillPackPath,
            registeredSkillPack,
        };
    }
    catch (error) {
        if (!(0, atomic_json_1.isAlreadyExistsError)(error)) {
            throw error;
        }
    }
    const racedSkillPack = await repository.findByPackRef(registeredSkillPack.packRef);
    if (racedSkillPack) {
        return resolveAgainstExistingRegistration(skillPackStoragePaths, registeredSkillPack, racedSkillPack);
    }
    throw new Error(`Dir orpheline non revendiquable pour le skill pack \`${registeredSkillPack.packRef}\`: aucun manifeste publie et le claim atomique a echoue.`);
}
function resolveAgainstExistingRegistration(skillPackStoragePaths, registeredSkillPack, existingSkillPack) {
    if ((0, structural_compare_1.deepStrictEqualForComparison)(toComparableRegisteredSkillPack(existingSkillPack), toComparableRegisteredSkillPack(registeredSkillPack))) {
        return {
            status: "unchanged",
            skillPackDir: skillPackStoragePaths.skillPackDir,
            skillPackPath: skillPackStoragePaths.skillPackPath,
            registeredSkillPack: existingSkillPack,
        };
    }
    throw new Error(`Conflit d'ecriture concurrente legitime pour le skill pack \`${registeredSkillPack.packRef}\`: un manifeste different a ete publie par un writer concurrent.`);
}
// Budget total ~500ms avec backoff exponentiel plafonne, afin d'absorber les writers
// concurrents qui mettent plus de 50ms a publier (anciennement 5 x 10ms, trop serre).
const CONCURRENT_WRITE_INITIAL_DELAY_MS = 10;
const CONCURRENT_WRITE_MAX_DELAY_MS = 160;
const CONCURRENT_WRITE_TOTAL_BUDGET_MS = 500;
async function waitForConcurrentSkillPackWrite(repository, packRef) {
    let elapsedMs = 0;
    let nextDelayMs = CONCURRENT_WRITE_INITIAL_DELAY_MS;
    while (elapsedMs < CONCURRENT_WRITE_TOTAL_BUDGET_MS) {
        const existingSkillPack = await repository.findByPackRef(packRef);
        if (existingSkillPack) {
            return existingSkillPack;
        }
        const remainingBudgetMs = CONCURRENT_WRITE_TOTAL_BUDGET_MS - elapsedMs;
        const sleepMs = Math.min(nextDelayMs, remainingBudgetMs);
        await delay(sleepMs);
        elapsedMs += sleepMs;
        nextDelayMs = Math.min(nextDelayMs * 2, CONCURRENT_WRITE_MAX_DELAY_MS);
    }
    return null;
}
async function delay(durationMs) {
    await new Promise((resolve) => {
        setTimeout(resolve, durationMs);
    });
}
async function writeRegisteredSkillPackIfMissing(skillPackPath, registeredSkillPack) {
    await (0, promises_1.writeFile)(skillPackPath, `${JSON.stringify(registeredSkillPack, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
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
