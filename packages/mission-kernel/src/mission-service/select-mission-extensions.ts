import { randomUUID } from "node:crypto";

import type {
  Mission,
  MissionAuthorizedExtensions,
} from "../../../contracts/src/mission/mission";
import { appendEvent, type JournalEventRecord } from "../../../journal/src/event-log/append-event";
import { resolveWorkspaceLayout } from "../../../storage/src/fs-layout/workspace-layout";
import { createFileCapabilityRegistryRepository } from "../../../storage/src/repositories/file-capability-registry-repository";
import { createFileSkillPackRegistryRepository } from "../../../storage/src/repositories/file-skill-pack-registry-repository";
import { createFileMissionRepository } from "../../../storage/src/repositories/file-mission-repository";
import { createFileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import {
  ensureMissionWorkspaceInitialized,
  isBuiltInAllowedCapability,
  normalizeOpaqueReferences,
  requireText,
  rewriteMissionReadModels,
} from "../../../ticket-runtime/src/ticket-service/ticket-service-support";
import { deepStrictEqualIgnoringArrayOrder } from "../../../ticket-runtime/src/utils/structural-compare";

export interface SelectMissionExtensionsOptions {
  rootDir: string;
  missionId?: string;
  allowedCapabilities: string[];
  clearAllowedCapabilities: boolean;
  skillPackRefs: string[];
  clearSkillPackRefs: boolean;
}

export interface SelectMissionExtensionsResult {
  mission: Mission;
  event: JournalEventRecord;
}

export async function selectMissionExtensions(
  options: SelectMissionExtensionsOptions,
): Promise<SelectMissionExtensionsResult> {
  const layout = resolveWorkspaceLayout(options.rootDir);
  await ensureMissionWorkspaceInitialized(layout, "extension select");

  if (!hasAnyExtensionMutation(options)) {
    throw new Error("Aucune mutation demandee pour `corp mission extension select`.");
  }

  const missionId = requireText(
    options.missionId,
    "L'option --mission-id est obligatoire pour `corp mission extension select`.",
  );
  const missionRepository = createFileMissionRepository(layout);
  const ticketRepository = createFileTicketRepository(layout);
  const capabilityRegistryRepository = createFileCapabilityRegistryRepository(layout);
  const skillPackRegistryRepository = createFileSkillPackRegistryRepository(layout);
  const mission = await missionRepository.findById(missionId);

  if (!mission) {
    throw new Error(`Mission introuvable: ${missionId}.`);
  }

  ensureMissionAcceptsExtensionSelect(mission);

  const nextAuthorizedExtensions = resolveNextAuthorizedExtensions(mission, options);

  await assertMissionExtensionSelectionRegistered({
    capabilityRegistryRepository,
    skillPackRegistryRepository,
    authorizedExtensions: nextAuthorizedExtensions,
  });

  const changedFields = collectChangedFields(
    mission.authorizedExtensions,
    nextAuthorizedExtensions,
  );

  if (changedFields.length === 0) {
    throw new Error(
      `Aucune mutation effective detectee pour la selection d'extensions de la mission \`${mission.id}\`.`,
    );
  }

  const occurredAt = new Date().toISOString();
  const eventId = `event_${randomUUID()}`;
  const updatedMission: Mission = {
    ...mission,
    authorizedExtensions: nextAuthorizedExtensions,
    eventIds: [...mission.eventIds, eventId],
    resumeCursor: eventId,
    updatedAt: occurredAt,
  };
  const event: JournalEventRecord = {
    eventId,
    type: "mission.extensions_selected",
    missionId: mission.id,
    occurredAt,
    actor: "operator",
    source: "corp-cli",
    payload: {
      mission: updatedMission,
      previousAuthorizedExtensions: mission.authorizedExtensions,
      authorizedExtensions: updatedMission.authorizedExtensions,
      changedFields,
      trigger: "operator",
    },
  };

  await appendEvent(layout.journalPath, event);
  await missionRepository.save(updatedMission);
  await rewriteMissionReadModels(layout, updatedMission, ticketRepository);

  return {
    mission: updatedMission,
    event,
  };
}

function hasAnyExtensionMutation(options: {
  allowedCapabilities: string[];
  clearAllowedCapabilities: boolean;
  skillPackRefs: string[];
  clearSkillPackRefs: boolean;
}): boolean {
  return options.allowedCapabilities.length > 0
    || options.clearAllowedCapabilities
    || options.skillPackRefs.length > 0
    || options.clearSkillPackRefs;
}

function resolveNextAuthorizedExtensions(
  mission: Mission,
  options: {
    allowedCapabilities: string[];
    clearAllowedCapabilities: boolean;
    skillPackRefs: string[];
    clearSkillPackRefs: boolean;
  },
): MissionAuthorizedExtensions {
  return {
    allowedCapabilities: options.clearAllowedCapabilities
      ? []
      : options.allowedCapabilities.length > 0
        ? normalizeOpaqueReferences(options.allowedCapabilities)
        : [...mission.authorizedExtensions.allowedCapabilities],
    skillPackRefs: options.clearSkillPackRefs
      ? []
      : options.skillPackRefs.length > 0
        ? normalizeOpaqueReferences(options.skillPackRefs)
        : [...mission.authorizedExtensions.skillPackRefs],
  };
}

async function assertMissionExtensionSelectionRegistered(options: {
  capabilityRegistryRepository: ReturnType<typeof createFileCapabilityRegistryRepository>;
  skillPackRegistryRepository: ReturnType<typeof createFileSkillPackRegistryRepository>;
  authorizedExtensions: MissionAuthorizedExtensions;
}): Promise<void> {
  for (const capabilityId of options.authorizedExtensions.allowedCapabilities) {
    if (isBuiltInAllowedCapability(capabilityId)) {
      throw new Error(
        `La capability built-in \`${capabilityId}\` reste hors selection mission. N'utilisez pas \`corp mission extension select\` pour les built-ins.`,
      );
    }

    const capability = await options.capabilityRegistryRepository.findByCapabilityId(capabilityId);

    if (!capability) {
      throw new Error(`Capability introuvable dans le registre local: ${capabilityId}.`);
    }
  }

  for (const packRef of options.authorizedExtensions.skillPackRefs) {
    const skillPack = await options.skillPackRegistryRepository.findByPackRef(packRef);

    if (!skillPack) {
      throw new Error(`Skill pack introuvable dans le registre local: ${packRef}.`);
    }
  }
}

function collectChangedFields(
  previousAuthorizedExtensions: MissionAuthorizedExtensions,
  nextAuthorizedExtensions: MissionAuthorizedExtensions,
): string[] {
  const changedFields: string[] = [];

  if (
    !deepStrictEqualIgnoringArrayOrder(
      previousAuthorizedExtensions.allowedCapabilities,
      nextAuthorizedExtensions.allowedCapabilities,
    )
  ) {
    changedFields.push("allowedCapabilities");
  }

  if (
    !deepStrictEqualIgnoringArrayOrder(
      previousAuthorizedExtensions.skillPackRefs,
      nextAuthorizedExtensions.skillPackRefs,
    )
  ) {
    changedFields.push("skillPackRefs");
  }

  return changedFields;
}

const TERMINAL_MISSION_STATUSES = new Set<string>([
  "completed",
  "cancelled",
  "failed",
]);

function ensureMissionAcceptsExtensionSelect(mission: Mission): void {
  if (TERMINAL_MISSION_STATUSES.has(mission.status)) {
    throw new Error(
      `Impossible de modifier la selection d'extensions de la mission \`${mission.id}\` car son statut est terminal (\`${mission.status}\`).`,
    );
  }
}
