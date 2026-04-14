#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runCli = runCli;
const extension_command_1 = require("./commands/extension-command");
const mission_command_1 = require("./commands/mission-command");
const help_formatter_1 = require("./formatters/help-formatter");
async function runCli(args, context = createDefaultContext()) {
    const [command, ...rest] = args;
    try {
        if (!command || command === "help" || command === "--help" || command === "-h") {
            writeHelp(context);
            return 0;
        }
        if (command === "mission") {
            return await (0, mission_command_1.runMissionCommand)(rest, context);
        }
        if (command === "extension") {
            return await (0, extension_command_1.runExtensionCommand)(rest, context);
        }
        context.writeLine(`Commande inconnue: ${command}`);
        writeHelp(context);
        return 1;
    }
    catch (error) {
        context.writeLine(error instanceof Error ? error.message : String(error));
        return 1;
    }
}
function createDefaultContext() {
    return {
        writeLine: (line) => console.log(line),
    };
}
function writeHelp(context) {
    for (const line of (0, help_formatter_1.formatRootHelp)()) {
        context.writeLine(line);
    }
}
async function main() {
    const exitCode = await runCli(process.argv.slice(2));
    process.exitCode = exitCode;
}
if (require.main === module) {
    void main();
}
