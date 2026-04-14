import { mkdir } from "node:fs/promises";
import path from "node:path";

export interface WorkspaceLayout {
  rootDir: string;
  corpDir: string;
  journalDir: string;
  journalPath: string;
  projectionsDir: string;
  missionsDir: string;
  isolationsDir: string;
  capabilitiesDir: string;
  skillPacksDir: string;
}

export interface MissionStoragePaths {
  missionDir: string;
  missionPath: string;
}

export interface TicketStoragePaths {
  ticketsDir: string;
  ticketDir: string;
  ticketPath: string;
}

export interface ExecutionAttemptStoragePaths {
  attemptsDir: string;
  attemptDir: string;
  attemptPath: string;
}

export interface ArtifactStoragePaths {
  artifactsDir: string;
  artifactDir: string;
  artifactPath: string;
}

export interface CapabilityStoragePaths {
  capabilityDir: string;
  capabilityPath: string;
}

export interface SkillPackStoragePaths {
  skillPackDir: string;
  skillPackPath: string;
}

export function resolveWorkspaceLayout(rootDir: string): WorkspaceLayout {
  const resolvedRootDir = path.resolve(rootDir);
  const corpDir = path.join(resolvedRootDir, ".corp");
  const journalDir = path.join(corpDir, "journal");
  const projectionsDir = path.join(corpDir, "projections");
  const missionsDir = path.join(corpDir, "missions");
  const isolationsDir = path.join(corpDir, "isolations");
  const capabilitiesDir = path.join(corpDir, "capabilities");
  const skillPacksDir = path.join(corpDir, "skill-packs");

  return {
    rootDir: resolvedRootDir,
    corpDir,
    journalDir,
    journalPath: path.join(journalDir, "events.jsonl"),
    projectionsDir,
    missionsDir,
    isolationsDir,
    capabilitiesDir,
    skillPacksDir,
  };
}

export async function ensureWorkspaceLayout(rootDir: string): Promise<WorkspaceLayout> {
  const layout = resolveWorkspaceLayout(rootDir);

  await mkdir(layout.journalDir, { recursive: true });
  await mkdir(layout.projectionsDir, { recursive: true });
  await mkdir(layout.missionsDir, { recursive: true });
  await mkdir(layout.isolationsDir, { recursive: true });
  await mkdir(layout.capabilitiesDir, { recursive: true });
  await mkdir(layout.skillPacksDir, { recursive: true });

  return layout;
}

const MAX_STORAGE_ID_LENGTH = 255;
const UNSAFE_STORAGE_ID_PATTERN = /[/\\]|\.\.|^\.?$|\x00/;

export function resolveMissionStoragePaths(
  layout: WorkspaceLayout,
  missionId: string,
): MissionStoragePaths {
  assertSafeStorageIdentifier(missionId, "mission");

  const missionDir = path.join(layout.missionsDir, missionId);

  return {
    missionDir,
    missionPath: path.join(missionDir, "mission.json"),
  };
}

export function resolveTicketStoragePaths(
  layout: WorkspaceLayout,
  missionId: string,
  ticketId: string,
): TicketStoragePaths {
  const missionStoragePaths = resolveMissionStoragePaths(layout, missionId);

  assertSafeStorageIdentifier(ticketId, "ticket");

  const ticketsDir = path.join(missionStoragePaths.missionDir, "tickets");
  const ticketDir = path.join(ticketsDir, ticketId);

  return {
    ticketsDir,
    ticketDir,
    ticketPath: path.join(ticketDir, "ticket.json"),
  };
}

export function resolveExecutionAttemptStoragePaths(
  layout: WorkspaceLayout,
  missionId: string,
  ticketId: string,
  attemptId: string,
): ExecutionAttemptStoragePaths {
  const ticketStoragePaths = resolveTicketStoragePaths(layout, missionId, ticketId);

  assertSafeStorageIdentifier(attemptId, "attempt");

  const attemptsDir = path.join(ticketStoragePaths.ticketDir, "attempts");
  const attemptDir = path.join(attemptsDir, attemptId);

  return {
    attemptsDir,
    attemptDir,
    attemptPath: path.join(attemptDir, "attempt.json"),
  };
}

export function resolveArtifactStoragePaths(
  layout: WorkspaceLayout,
  missionId: string,
  ticketId: string,
  artifactId: string,
): ArtifactStoragePaths {
  const ticketStoragePaths = resolveTicketStoragePaths(layout, missionId, ticketId);

  assertSafeStorageIdentifier(artifactId, "artifact");

  const artifactsDir = path.join(ticketStoragePaths.ticketDir, "artifacts");
  const artifactDir = path.join(artifactsDir, artifactId);

  return {
    artifactsDir,
    artifactDir,
    artifactPath: path.join(artifactDir, "artifact.json"),
  };
}

export function resolveCapabilityStoragePaths(
  layout: WorkspaceLayout,
  capabilityId: string,
): CapabilityStoragePaths {
  assertSafeStorageIdentifier(capabilityId, "capability");

  const capabilityDir = path.join(layout.capabilitiesDir, capabilityId);

  return {
    capabilityDir,
    capabilityPath: path.join(capabilityDir, "capability.json"),
  };
}

export function resolveSkillPackStoragePaths(
  layout: WorkspaceLayout,
  packRef: string,
): SkillPackStoragePaths {
  assertSafeStorageIdentifier(packRef, "skill pack");

  const skillPackDir = path.join(layout.skillPacksDir, packRef);

  return {
    skillPackDir,
    skillPackPath: path.join(skillPackDir, "skill-pack.json"),
  };
}

function assertSafeStorageIdentifier(
  value: string,
  label: "mission" | "ticket" | "attempt" | "artifact" | "capability" | "skill pack",
): void {
  if (
    !value
    || !value.trim()
    || value.length > MAX_STORAGE_ID_LENGTH
    || UNSAFE_STORAGE_ID_PATTERN.test(value)
  ) {
    throw new Error(`Identifiant de ${label} invalide: ${value}.`);
  }
}
