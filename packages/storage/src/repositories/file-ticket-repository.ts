import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { Mission } from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import {
  resolveMissionStoragePaths,
  resolveTicketStoragePaths,
  type WorkspaceLayout,
} from "../fs-layout/workspace-layout";

export const MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP = 50;

const SEARCHABLE_MISSION_DIRECTORY_NAME_PATTERN = /^mission_[A-Za-z0-9_-]+$/;

export interface SaveTicketResult {
  ticketsDir: string;
  ticketDir: string;
  ticketPath: string;
}

export class FileTicketRepository {
  public constructor(private readonly layout: WorkspaceLayout) {}

  public async save(ticket: Ticket): Promise<SaveTicketResult> {
    const ticketStoragePaths = resolveTicketStoragePaths(
      this.layout,
      ticket.missionId,
      ticket.id,
    );

    await mkdir(ticketStoragePaths.ticketDir, { recursive: true });
    await writeFile(
      ticketStoragePaths.ticketPath,
      `${JSON.stringify(ticket, null, 2)}\n`,
      "utf8",
    );

    return ticketStoragePaths;
  }

  public async findById(missionId: string, ticketId: string): Promise<Ticket | null> {
    const ticketStoragePaths = resolveTicketStoragePaths(this.layout, missionId, ticketId);

    try {
      const storedTicket = await readFile(ticketStoragePaths.ticketPath, "utf8");
      return JSON.parse(storedTicket) as Ticket;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }
  }

  public async findOwningMissionId(ticketId: string): Promise<string | null> {
    const missionEntries = (await readMissionDirectories(this.layout.missionsDir))
      .filter((missionEntry) => isSearchableMissionDirectory(missionEntry));

    if (missionEntries.length > MAX_EXHAUSTIVE_MISSION_OWNERSHIP_LOOKUP) {
      throw new Error("Trop de missions pour une recherche exhaustive.");
    }

    const owningMissionIdsByTicketId = new Map<string, string>();

    for (const missionEntry of missionEntries) {
      const mission = await this.readMissionSnapshot(missionEntry.name);

      if (!mission) {
        continue;
      }

      for (const missionTicketId of mission.ticketIds) {
        if (!owningMissionIdsByTicketId.has(missionTicketId)) {
          owningMissionIdsByTicketId.set(missionTicketId, mission.id);
        }
      }
    }

    return owningMissionIdsByTicketId.get(ticketId) ?? null;
  }

  public async listByMissionId(missionId: string): Promise<Ticket[]> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, missionId);
    const ticketsDir = path.join(missionStoragePaths.missionDir, "tickets");
    const ticketEntries = await readDirectoryEntries(ticketsDir);
    const tickets: Ticket[] = [];

    for (const ticketEntry of ticketEntries) {
      if (!ticketEntry.isDirectory()) {
        continue;
      }

      const ticket = await this.findById(missionId, ticketEntry.name);

      if (ticket) {
        tickets.push(ticket);
      }
    }

    return tickets;
  }

  private async readMissionSnapshot(missionId: string): Promise<Mission | null> {
    const missionStoragePaths = resolveMissionStoragePaths(this.layout, missionId);

    try {
      const storedMission = await readFile(missionStoragePaths.missionPath, "utf8");
      return JSON.parse(storedMission) as Mission;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }
  }
}

export function createFileTicketRepository(
  layout: WorkspaceLayout,
): FileTicketRepository {
  return new FileTicketRepository(layout);
}

async function readMissionDirectories(
  missionsDir: string,
): Promise<Dirent[]> {
  return readDirectoryEntries(missionsDir);
}

async function readDirectoryEntries(directoryPath: string): Promise<Dirent[]> {
  try {
    return await readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}

function isSearchableMissionDirectory(entry: Dirent): boolean {
  return entry.isDirectory()
    && SEARCHABLE_MISSION_DIRECTORY_NAME_PATTERN.test(entry.name);
}

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}
