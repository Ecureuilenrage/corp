import type { MissionResume } from "../../../../packages/contracts/src/mission/mission-resume";
import type { TicketBoardEntry } from "../../../../packages/journal/src/projections/ticket-board-projection";
import { formatMissionResume } from "./mission-resume-formatter";
import { formatTicketBoard } from "./ticket-board-formatter";

export function formatMissionStatus(
  resume: MissionResume,
  ticketBoardEntries: TicketBoardEntry[],
): string[] {
  return [
    ...formatMissionResume(resume),
    "",
    ...formatTicketBoard(ticketBoardEntries),
  ];
}
