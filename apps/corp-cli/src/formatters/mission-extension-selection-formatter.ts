import type { Mission } from "../../../../packages/contracts/src/mission/mission";

export function formatMissionExtensionSelection(mission: Mission): string[] {
  return [
    `Mission: ${mission.id}`,
    "Extensions mission mises a jour.",
    `Capabilities mission: ${formatList(mission.authorizedExtensions.allowedCapabilities, "aucune")}`,
    `Skill packs mission: ${formatList(mission.authorizedExtensions.skillPackRefs, "aucun")}`,
  ];
}

function formatList(values: string[], emptyValue: string): string {
  return values.length > 0 ? values.join(", ") : emptyValue;
}
