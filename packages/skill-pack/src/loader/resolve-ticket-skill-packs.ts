import type { ResolvedSkillPackSummary } from "../../../contracts/src/extension/registered-skill-pack";
import type { Mission } from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { SkillPackRegistryReader } from "../../../storage/src/repositories/file-skill-pack-registry-repository";
import { buildSkillPackSummary } from "../metadata/build-skill-pack-summary";
import { assertSkillPackLocalBoundary } from "../references/assert-skill-pack-local-boundary";
import { readRegisteredSkillPack } from "./read-registered-skill-pack";

export interface ResolveTicketSkillPacksOptions {
  repository: SkillPackRegistryReader;
  mission: Mission;
  ticket: Ticket;
}

export async function resolveTicketSkillPacks(
  options: ResolveTicketSkillPacksOptions,
): Promise<ResolvedSkillPackSummary[]> {
  if (options.ticket.skillPackRefs.length === 0) {
    return [];
  }

  const uniquePackRefs = [...new Set(options.ticket.skillPackRefs)];
  const summaries: ResolvedSkillPackSummary[] = [];

  for (const packRef of uniquePackRefs) {
    const registeredSkillPack = await readRegisteredSkillPack({
      repository: options.repository,
      packRef,
    });

    assertSkillPackLocalBoundary({
      packRef: registeredSkillPack.packRef,
      localRefs: registeredSkillPack.localRefs,
    });

    summaries.push(buildSkillPackSummary(registeredSkillPack));
  }

  return summaries;
}
