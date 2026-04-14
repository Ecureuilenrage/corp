export type MissionStatus =
  | "draft"
  | "ready"
  | "running"
  | "blocked"
  | "awaiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export interface MissionAuthorizedExtensions {
  allowedCapabilities: string[];
  skillPackRefs: string[];
}

export interface Mission {
  id: string;
  title: string;
  objective: string;
  status: MissionStatus;
  successCriteria: string[];
  policyProfileId: string;
  authorizedExtensions: MissionAuthorizedExtensions;
  ticketIds: string[];
  artifactIds: string[];
  eventIds: string[];
  resumeCursor: string;
  createdAt: string;
  updatedAt: string;
}

export function createEmptyMissionAuthorizedExtensions(): MissionAuthorizedExtensions {
  return {
    allowedCapabilities: [],
    skillPackRefs: [],
  };
}

export function normalizeMissionAuthorizedExtensions(
  value: Partial<MissionAuthorizedExtensions> | null | undefined,
): MissionAuthorizedExtensions {
  return {
    allowedCapabilities: normalizeMissionReferenceList(value?.allowedCapabilities),
    skillPackRefs: normalizeMissionReferenceList(value?.skillPackRefs),
  };
}

export function hydrateMission(
  mission: Omit<Mission, "authorizedExtensions"> & {
    authorizedExtensions?: Partial<MissionAuthorizedExtensions> | null;
  },
): Mission {
  return {
    ...mission,
    authorizedExtensions: normalizeMissionAuthorizedExtensions(
      mission.authorizedExtensions,
    ),
  };
}

function normalizeMissionReferenceList(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalizedValues: string[] = [];
  const seenValues = new Set<string>();

  for (const value of values) {
    if (typeof value !== "string") {
      continue;
    }

    const normalizedValue = value.trim();

    if (!normalizedValue || seenValues.has(normalizedValue)) {
      continue;
    }

    seenValues.add(normalizedValue);
    normalizedValues.push(normalizedValue);
  }

  return normalizedValues;
}
