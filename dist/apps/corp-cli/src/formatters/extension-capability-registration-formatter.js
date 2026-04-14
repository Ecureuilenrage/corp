"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatExtensionCapabilityRegistration = formatExtensionCapabilityRegistration;
function formatExtensionCapabilityRegistration(result) {
    return [
        `Capability enregistree: ${result.registeredCapability.capabilityId}`,
        `Statut: ${result.status}`,
        `Workspace entry: ${result.capabilityPath}`,
        `Fichier: ${result.registeredCapability.sourceManifestPath}`,
        `Provider: ${result.registeredCapability.provider}`,
        `Registration: ${result.registeredCapability.registrationId}`,
        `Permissions: ${formatList(result.registeredCapability.permissions, "aucune")}`,
        `Contraintes: ${formatList(result.registeredCapability.constraints, "aucune")}`,
    ];
}
function formatList(values, fallback) {
    return values.length > 0 ? values.join(", ") : fallback;
}
