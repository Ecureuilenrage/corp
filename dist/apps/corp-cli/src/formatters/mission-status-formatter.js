"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatMissionStatus = formatMissionStatus;
const mission_resume_formatter_1 = require("./mission-resume-formatter");
const ticket_board_formatter_1 = require("./ticket-board-formatter");
function formatMissionStatus(resume, ticketBoardEntries) {
    return [
        ...(0, mission_resume_formatter_1.formatMissionResume)(resume),
        "",
        ...(0, ticket_board_formatter_1.formatTicketBoard)(ticketBoardEntries),
    ];
}
