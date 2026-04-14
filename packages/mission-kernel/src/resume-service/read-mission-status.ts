import type { MissionResume } from "../../../contracts/src/mission/mission-resume";
import type { TicketBoardProjection } from "../../../journal/src/projections/ticket-board-projection";
import { readMissionResume } from "./read-mission-resume";

export interface ReadMissionStatusOptions {
  rootDir: string;
  missionId: string;
}

export interface ReadMissionStatusResult {
  resume: MissionResume;
  ticketBoard: TicketBoardProjection;
  reconstructed: boolean;
}

export async function readMissionStatus(
  options: ReadMissionStatusOptions,
): Promise<ReadMissionStatusResult> {
  const resumeResult = await readMissionResume({
    rootDir: options.rootDir,
    missionId: options.missionId,
    commandName: "status",
  });
  return {
    resume: resumeResult.resume,
    ticketBoard: resumeResult.ticketBoard,
    reconstructed: resumeResult.reconstructed || resumeResult.ticketBoardReconstructed,
  };
}
