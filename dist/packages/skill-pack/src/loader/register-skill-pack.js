"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerSkillPack = registerSkillPack;
const read_extension_registration_file_1 = require("../../../capability-registry/src/validation/read-extension-registration-file");
const assert_skill_pack_local_boundary_1 = require("../references/assert-skill-pack-local-boundary");
async function registerSkillPack(options) {
    const readResult = await (0, read_extension_registration_file_1.readExtensionRegistrationFile)(options.filePath);
    if (!readResult.ok || !readResult.registration || !readResult.resolvedLocalRefs) {
        throw new Error(resolveRegistrationErrorMessage(readResult.diagnostics));
    }
    if (readResult.registration.seamType !== "skill_pack") {
        throw new Error(`Seam non supporte pour \`corp extension skill-pack register\`: ${readResult.registration.seamType}. Seul \`skill_pack\` est accepte.`);
    }
    const registeredSkillPack = buildRegisteredSkillPack(readResult.registration, readResult.resolvedLocalRefs, readResult.filePath, options.registeredAt ?? new Date().toISOString());
    (0, assert_skill_pack_local_boundary_1.assertSkillPackLocalBoundary)({
        packRef: registeredSkillPack.packRef,
        localRefs: registeredSkillPack.localRefs,
    });
    return await options.repository.save(registeredSkillPack);
}
function buildRegisteredSkillPack(registration, resolvedLocalRefs, filePath, registeredAt) {
    return {
        packRef: registration.skillPack.packRef,
        registrationId: registration.id,
        schemaVersion: registration.schemaVersion,
        displayName: registration.displayName,
        version: registration.version,
        permissions: [...registration.permissions],
        constraints: [...registration.constraints],
        metadata: {
            ...registration.metadata,
            tags: [...registration.metadata.tags],
        },
        localRefs: {
            rootDir: resolvedLocalRefs.rootDir,
            references: [...resolvedLocalRefs.references],
            ...(resolvedLocalRefs.metadataFile
                ? { metadataFile: resolvedLocalRefs.metadataFile }
                : {}),
            scripts: [...resolvedLocalRefs.scripts],
        },
        registeredAt,
        sourceManifestPath: filePath,
    };
}
function resolveRegistrationErrorMessage(diagnostics) {
    if (diagnostics.length === 0) {
        return "Manifeste invalide pour l'enregistrement de skill pack.";
    }
    return diagnostics
        .map((diagnostic) => `[${diagnostic.code}] ${diagnostic.path} - ${diagnostic.message}`)
        .join("\n");
}
