#!/usr/bin/env node

import { runExtensionCommand } from "./commands/extension-command";
import { runMissionCommand, type CliOutput } from "./commands/mission-command";
import { formatRootHelp } from "./formatters/help-formatter";

export interface CliContext extends CliOutput {}

export async function runCli(
  args: string[],
  context: CliContext = createDefaultContext(),
): Promise<number> {
  const [command, ...rest] = args;

  try {
    if (!command || command === "help" || command === "--help" || command === "-h") {
      writeHelp(context);
      return 0;
    }

    if (command === "mission") {
      return await runMissionCommand(rest, context);
    }

    if (command === "extension") {
      return await runExtensionCommand(rest, context);
    }

    context.writeLine(`Commande inconnue: ${command}`);
    writeHelp(context);
    return 1;
  } catch (error) {
    context.writeLine(error instanceof Error ? error.message : String(error));
    return 1;
  }
}

function createDefaultContext(): CliContext {
  return {
    writeLine: (line: string) => console.log(line),
  };
}

function writeHelp(context: CliContext): void {
  for (const line of formatRootHelp()) {
    context.writeLine(line);
  }
}

async function main(): Promise<void> {
  const exitCode = await runCli(process.argv.slice(2));
  process.exitCode = exitCode;
}

if (require.main === module) {
  void main();
}
