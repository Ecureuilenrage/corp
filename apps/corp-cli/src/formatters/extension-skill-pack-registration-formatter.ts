import type { RegisterSkillPackResult } from "../../../../packages/skill-pack/src/loader/register-skill-pack";

export function formatExtensionSkillPackRegistration(
  result: RegisterSkillPackResult,
): string[] {
  return [
    `Skill pack enregistre: ${result.registeredSkillPack.packRef}`,
    `Statut: ${result.status}`,
    `Workspace entry: ${result.skillPackPath}`,
    `Fichier: ${result.registeredSkillPack.sourceManifestPath}`,
    `Display name: ${result.registeredSkillPack.displayName}`,
    `Permissions: ${formatList(result.registeredSkillPack.permissions, "aucune")}`,
    `Contraintes: ${formatList(result.registeredSkillPack.constraints, "aucune")}`,
  ];
}

function formatList(values: string[], fallback: string): string {
  return values.length > 0 ? values.join(", ") : fallback;
}
