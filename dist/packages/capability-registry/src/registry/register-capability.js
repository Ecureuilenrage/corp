"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCapability = registerCapability;
const read_extension_registration_file_1 = require("../validation/read-extension-registration-file");
async function registerCapability(options) {
    const readResult = await (0, read_extension_registration_file_1.readExtensionRegistrationFile)(options.filePath);
    if (!readResult.ok || !readResult.registration || !readResult.resolvedLocalRefs) {
        throw new Error(resolveRegistrationErrorMessage(readResult.diagnostics));
    }
    if (readResult.registration.seamType !== "capability") {
        throw new Error(`Seam non supporte pour \`corp extension capability register\`: ${readResult.registration.seamType}. Seul \`capability\` est accepte.`);
    }
    const registeredCapability = buildRegisteredCapability(readResult.registration, readResult.resolvedLocalRefs, readResult.filePath, options.registeredAt ?? new Date().toISOString());
    return await options.repository.save(registeredCapability);
}
function buildRegisteredCapability(registration, resolvedLocalRefs, filePath, registeredAt) {
    return {
        capabilityId: registration.capability.capabilityId,
        registrationId: registration.id,
        schemaVersion: registration.schemaVersion,
        provider: registration.capability.provider,
        displayName: registration.displayName,
        version: registration.version,
        permissions: [...registration.permissions],
        constraints: [...registration.constraints],
        approvalSensitive: registration.capability.approvalSensitive,
        requiredEnvNames: [...registration.capability.requiredEnvNames],
        metadata: {
            ...registration.metadata,
            tags: [...registration.metadata.tags],
        },
        localRefs: {
            rootDir: resolvedLocalRefs.rootDir,
            ...(resolvedLocalRefs.entrypoint
                ? { entrypoint: resolvedLocalRefs.entrypoint }
                : {}),
            references: [...resolvedLocalRefs.references],
            ...(resolvedLocalRefs.metadataFile
                ? { metadataFile: resolvedLocalRefs.metadataFile }
                : {}),
            scripts: [...resolvedLocalRefs.scripts],
        },
        mcp: registration.capability.provider === "mcp"
            ? buildRegisteredCapabilityMcpBinding(registration)
            : null,
        registeredAt,
        sourceManifestPath: filePath,
    };
}
function buildRegisteredCapabilityMcpBinding(registration) {
    const serverName = registration.capability.mcpServerName?.trim();
    const toolName = registration.capability.mcpToolName?.trim();
    if (!serverName || !toolName) {
        throw new Error("Les champs `mcpServerName` et `mcpToolName` sont obligatoires pour une capability MCP.");
    }
    return {
        serverName,
        toolName,
    };
}
function resolveRegistrationErrorMessage(diagnostics) {
    const hasMcpBindingError = diagnostics.some((diagnostic) => diagnostic.path === "capability.mcpServerName"
        || diagnostic.path === "capability.mcpToolName");
    const nonMcpDiagnostics = diagnostics.filter((diagnostic) => diagnostic.path !== "capability.mcpServerName"
        && diagnostic.path !== "capability.mcpToolName");
    if (hasMcpBindingError && nonMcpDiagnostics.length === 0) {
        return "Les champs `mcpServerName` et `mcpToolName` sont obligatoires pour une capability MCP.";
    }
    if (hasMcpBindingError) {
        return `Les champs \`mcpServerName\` et \`mcpToolName\` sont obligatoires pour une capability MCP.\n${formatRegistrationDiagnostics(nonMcpDiagnostics)}`;
    }
    return formatRegistrationDiagnostics(diagnostics);
}
function formatRegistrationDiagnostics(diagnostics) {
    if (diagnostics.length === 0) {
        return "Manifeste invalide pour l'enregistrement de capability.";
    }
    return diagnostics
        .map((diagnostic) => `[${diagnostic.code}] ${diagnostic.path} - ${diagnostic.message}`)
        .join("\n");
}
