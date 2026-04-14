"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readMissionStatus = readMissionStatus;
const read_mission_resume_1 = require("./read-mission-resume");
async function readMissionStatus(options) {
    const resumeResult = await (0, read_mission_resume_1.readMissionResume)({
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
