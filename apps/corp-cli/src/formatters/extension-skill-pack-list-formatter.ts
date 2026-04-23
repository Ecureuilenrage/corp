import type {
  SkillPackListDiagnostic,
  SkillPackRegistryRepository,
} from "../../../../packages/storage/src/repositories/file-skill-pack-registry-repository";

type SkillPackListResult = Awaited<ReturnType<SkillPackRegistryRepository["listAll"]>>;

export function formatExtensionSkillPackList(
  result: SkillPackListResult,
): string[] {
  const lines = [
    `Skill packs valides: ${formatValidCount(result.valid.length)}`,
  ];

  for (const skillPack of result.valid) {
    lines.push(
      `- ${skillPack.packRef} | displayName=${skillPack.displayName} | version=${skillPack.version} | owner=${skillPack.metadata.owner}`,
    );
  }

  lines.push(
    `Diagnostics invalides: ${formatInvalidCount(result.invalid.length)}`,
  );

  for (const diagnostic of result.invalid) {
    lines.push(formatDiagnostic(diagnostic));
  }

  return lines;
}

function formatValidCount(count: number): string {
  return count === 0 ? "aucun" : String(count);
}

function formatInvalidCount(count: number): string {
  return count === 0 ? "aucun" : String(count);
}

function formatDiagnostic(diagnostic: SkillPackListDiagnostic): string {
  return `- ${diagnostic.packRef} | code=${diagnostic.code} | fichier=${diagnostic.filePath} | message=${diagnostic.message}`;
}
