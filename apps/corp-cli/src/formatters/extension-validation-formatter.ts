import type { ExtensionRegistrationDiagnostic } from "../../../../packages/contracts/src/extension/extension-registration";
import type { ExtensionRegistrationFileReadResult } from "../../../../packages/capability-registry/src/validation/read-extension-registration-file";

export function formatExtensionValidation(
  result: ExtensionRegistrationFileReadResult,
): string[] {
  const lines = [
    `Validation extension: ${result.ok ? "ok" : "echec"}`,
    `Fichier: ${result.filePath}`,
  ];

  if (result.registration) {
    lines.push(`Schema: ${result.registration.schemaVersion}`);
    lines.push(`Type de seam: ${result.registration.seamType}`);
    lines.push(`Declaration: ${result.registration.id}`);
    lines.push(`Version: ${result.registration.version}`);
    lines.push(`Permissions: ${formatList(result.registration.permissions, "aucune")}`);
    lines.push(`Contraintes: ${formatList(result.registration.constraints, "aucune")}`);

    if (result.registration.executionAdapter) {
      lines.push(`Adapter runtime: ${result.registration.executionAdapter.adapterRuntimeId}`);
      lines.push(
        `Env requis: ${formatList(result.registration.executionAdapter.requiredEnvNames, "aucun")}`,
      );
    }

    if (result.registration.capability) {
      lines.push(`Capability publique: ${result.registration.capability.capabilityId}`);
      lines.push(`Provider: ${result.registration.capability.provider}`);
      if (result.registration.capability.mcpServerName) {
        lines.push(`Serveur MCP: ${result.registration.capability.mcpServerName}`);
      }
      if (result.registration.capability.mcpToolName) {
        lines.push(`Outil MCP: ${result.registration.capability.mcpToolName}`);
      }
    }

    if (result.registration.skillPack) {
      lines.push(`Pack public: ${result.registration.skillPack.packRef}`);
    }

    if (result.resolvedLocalRefs) {
      lines.push(`Root local: ${result.resolvedLocalRefs.rootDir}`);
      if (result.resolvedLocalRefs.entrypoint) {
        lines.push(`Entrypoint: ${result.resolvedLocalRefs.entrypoint}`);
      }
      if (result.resolvedLocalRefs.metadataFile) {
        lines.push(`Metadata file: ${result.resolvedLocalRefs.metadataFile}`);
      }
      if (result.resolvedLocalRefs.references.length > 0) {
        lines.push(`References: ${result.resolvedLocalRefs.references.join(", ")}`);
      }
      if (result.resolvedLocalRefs.scripts.length > 0) {
        lines.push(`Scripts: ${result.resolvedLocalRefs.scripts.join(", ")}`);
      }
    }
  }

  if (result.diagnostics.length > 0) {
    lines.push("Diagnostics:");

    for (const [index, diagnostic] of result.diagnostics.entries()) {
      lines.push(`  ${index + 1}. ${formatDiagnostic(diagnostic)}`);
    }
  }

  return lines;
}

function formatDiagnostic(diagnostic: ExtensionRegistrationDiagnostic): string {
  return `[${diagnostic.code}] ${diagnostic.path} - ${diagnostic.message}`;
}

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}
