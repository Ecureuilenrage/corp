import type { RegisteredSkillPack } from "../../../contracts/src/extension/registered-skill-pack";
import type {
  SkillPackRegistration,
  ExtensionRegistrationDiagnostic,
} from "../../../contracts/src/extension/extension-registration";
import type {
  SaveRegisteredSkillPackResult,
  SkillPackRegistryRepository,
} from "../../../storage/src/repositories/file-skill-pack-registry-repository";
import { readExtensionRegistrationFile } from "../../../capability-registry/src/validation/read-extension-registration-file";
import { assertSkillPackLocalBoundary } from "../references/assert-skill-pack-local-boundary";

export interface RegisterSkillPackOptions {
  filePath: string;
  repository: SkillPackRegistryRepository;
  registeredAt?: string;
}

export interface RegisterSkillPackResult extends SaveRegisteredSkillPackResult {}

export async function registerSkillPack(
  options: RegisterSkillPackOptions,
): Promise<RegisterSkillPackResult> {
  const readResult = await readExtensionRegistrationFile(options.filePath);

  if (!readResult.ok || !readResult.registration || !readResult.resolvedLocalRefs) {
    throw new Error(resolveRegistrationErrorMessage(readResult.diagnostics));
  }

  if (readResult.registration.seamType !== "skill_pack") {
    throw new Error(
      `Seam non supporte pour \`corp extension skill-pack register\`: ${readResult.registration.seamType}. Seul \`skill_pack\` est accepte.`,
    );
  }

  const registeredSkillPack = buildRegisteredSkillPack(
    readResult.registration,
    readResult.resolvedLocalRefs,
    readResult.filePath,
    options.registeredAt ?? new Date().toISOString(),
  );

  assertSkillPackLocalBoundary({
    packRef: registeredSkillPack.packRef,
    localRefs: registeredSkillPack.localRefs,
  });

  return await options.repository.save(registeredSkillPack);
}

function buildRegisteredSkillPack(
  registration: SkillPackRegistration,
  resolvedLocalRefs: NonNullable<
    Awaited<ReturnType<typeof readExtensionRegistrationFile>>["resolvedLocalRefs"]
  >,
  filePath: string,
  registeredAt: string,
): RegisteredSkillPack {
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

function resolveRegistrationErrorMessage(
  diagnostics: ExtensionRegistrationDiagnostic[],
): string {
  if (diagnostics.length === 0) {
    return "Manifeste invalide pour l'enregistrement de skill pack.";
  }

  return diagnostics
    .map((diagnostic) =>
      `[${diagnostic.code}] ${diagnostic.path} - ${diagnostic.message}`
    )
    .join("\n");
}
