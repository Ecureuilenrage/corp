import type { RegisterCapabilityResult } from "../../../../packages/capability-registry/src/registry/register-capability";

export function formatExtensionCapabilityRegistration(
  result: RegisterCapabilityResult,
): string[] {
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

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}
