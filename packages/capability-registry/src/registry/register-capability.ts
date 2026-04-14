import type { RegisteredCapability } from "../../../contracts/src/extension/registered-capability";
import type {
  CapabilityRegistration,
  ExtensionRegistrationDiagnostic,
} from "../../../contracts/src/extension/extension-registration";
import type {
  CapabilityRegistryRepository,
  SaveRegisteredCapabilityResult,
} from "../../../storage/src/repositories/file-capability-registry-repository";
import { readExtensionRegistrationFile } from "../validation/read-extension-registration-file";

export interface RegisterCapabilityOptions {
  filePath: string;
  repository: CapabilityRegistryRepository;
  registeredAt?: string;
}

export interface RegisterCapabilityResult
  extends SaveRegisteredCapabilityResult {}

export async function registerCapability(
  options: RegisterCapabilityOptions,
): Promise<RegisterCapabilityResult> {
  const readResult = await readExtensionRegistrationFile(options.filePath);

  if (!readResult.ok || !readResult.registration || !readResult.resolvedLocalRefs) {
    throw new Error(resolveRegistrationErrorMessage(readResult.diagnostics));
  }

  if (readResult.registration.seamType !== "capability") {
    throw new Error(
      `Seam non supporte pour \`corp extension capability register\`: ${readResult.registration.seamType}. Seul \`capability\` est accepte.`,
    );
  }

  const registeredCapability = buildRegisteredCapability(
    readResult.registration,
    readResult.resolvedLocalRefs,
    readResult.filePath,
    options.registeredAt ?? new Date().toISOString(),
  );

  return await options.repository.save(registeredCapability);
}

function buildRegisteredCapability(
  registration: CapabilityRegistration,
  resolvedLocalRefs: NonNullable<
    Awaited<ReturnType<typeof readExtensionRegistrationFile>>["resolvedLocalRefs"]
  >,
  filePath: string,
  registeredAt: string,
): RegisteredCapability {
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

function buildRegisteredCapabilityMcpBinding(
  registration: CapabilityRegistration,
): NonNullable<RegisteredCapability["mcp"]> {
  const serverName = registration.capability.mcpServerName?.trim();
  const toolName = registration.capability.mcpToolName?.trim();

  if (!serverName || !toolName) {
    throw new Error(
      "Les champs `mcpServerName` et `mcpToolName` sont obligatoires pour une capability MCP.",
    );
  }

  return {
    serverName,
    toolName,
  };
}

function resolveRegistrationErrorMessage(
  diagnostics: ExtensionRegistrationDiagnostic[],
): string {
  const hasMcpBindingError = diagnostics.some((diagnostic) =>
    diagnostic.path === "capability.mcpServerName"
    || diagnostic.path === "capability.mcpToolName"
  );
  const nonMcpDiagnostics = diagnostics.filter((diagnostic) =>
    diagnostic.path !== "capability.mcpServerName"
    && diagnostic.path !== "capability.mcpToolName"
  );

  if (hasMcpBindingError && nonMcpDiagnostics.length === 0) {
    return "Les champs `mcpServerName` et `mcpToolName` sont obligatoires pour une capability MCP.";
  }

  if (hasMcpBindingError) {
    return `Les champs \`mcpServerName\` et \`mcpToolName\` sont obligatoires pour une capability MCP.\n${formatRegistrationDiagnostics(nonMcpDiagnostics)}`;
  }

  return formatRegistrationDiagnostics(diagnostics);
}

function formatRegistrationDiagnostics(
  diagnostics: ExtensionRegistrationDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return "Manifeste invalide pour l'enregistrement de capability.";
  }

  return diagnostics
    .map((diagnostic) =>
      `[${diagnostic.code}] ${diagnostic.path} - ${diagnostic.message}`
    )
    .join("\n");
}
