import { access } from "node:fs/promises";

import { registerCapability } from "../../../../packages/capability-registry/src/registry/register-capability";
import { readRegisteredSkillPack } from "../../../../packages/skill-pack/src/loader/read-registered-skill-pack";
import { registerSkillPack } from "../../../../packages/skill-pack/src/loader/register-skill-pack";
import { resolveWorkspaceLayout } from "../../../../packages/storage/src/fs-layout/workspace-layout";
import { createFileCapabilityRegistryRepository } from "../../../../packages/storage/src/repositories/file-capability-registry-repository";
import { createFileSkillPackRegistryRepository } from "../../../../packages/storage/src/repositories/file-skill-pack-registry-repository";
import { readExtensionRegistrationFile } from "../../../../packages/capability-registry/src/validation/read-extension-registration-file";
import { formatExtensionHelp } from "../formatters/help-formatter";
import { formatExtensionCapabilityRegistration } from "../formatters/extension-capability-registration-formatter";
import { formatExtensionSkillPackList } from "../formatters/extension-skill-pack-list-formatter";
import { formatExtensionSkillPackRegistration } from "../formatters/extension-skill-pack-registration-formatter";
import { formatExtensionSkillPackShow } from "../formatters/extension-skill-pack-show-formatter";
import { formatExtensionValidation } from "../formatters/extension-validation-formatter";
import type { CliOutput } from "./mission-command";

interface ValidateExtensionCliOptions {
  filePath: string;
}

interface RegisterCapabilityCliOptions {
  rootDir: string;
  filePath: string;
}

interface RegisterSkillPackCliOptions {
  rootDir: string;
  filePath: string;
}

interface ShowSkillPackCliOptions {
  rootDir: string;
  packRef: string;
}

interface ListSkillPackCliOptions {
  rootDir: string;
}

export async function runExtensionCommand(
  args: string[],
  output: CliOutput,
): Promise<number> {
  const [subcommand, ...rest] = args;

  if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
    writeHelp(output);
    return 0;
  }

  if (subcommand === "validate") {
    const options = parseValidateExtensionArgs(rest);
    const result = await readExtensionRegistrationFile(options.filePath);

    for (const line of formatExtensionValidation(result)) {
      output.writeLine(line);
    }

    return result.ok ? 0 : 1;
  }

  if (subcommand === "capability") {
    return await runCapabilityExtensionCommand(rest, output);
  }

  if (subcommand === "skill-pack") {
    return await runSkillPackExtensionCommand(rest, output);
  }

  output.writeLine(`Commande extension inconnue: ${subcommand}`);
  writeHelp(output);
  return 1;
}

async function runCapabilityExtensionCommand(
  args: string[],
  output: CliOutput,
): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "register") {
    const options = parseRegisterCapabilityArgs(rest);
    const layout = resolveWorkspaceLayout(options.rootDir);

    await ensureExtensionWorkspaceDirectoryInitialized({
      layout,
      commandName: "capability register",
      directoryPath: layout.capabilitiesDir,
      directoryLabel: "capabilities",
    });

    const result = await registerCapability({
      filePath: options.filePath,
      repository: createFileCapabilityRegistryRepository(layout),
    });

    for (const line of formatExtensionCapabilityRegistration(result)) {
      output.writeLine(line);
    }

    return 0;
  }

  output.writeLine(`Commande extension capability inconnue: ${subcommand ?? "(vide)"}`);
  writeHelp(output);
  return 1;
}

async function runSkillPackExtensionCommand(
  args: string[],
  output: CliOutput,
): Promise<number> {
  const [subcommand, ...rest] = args;

  if (subcommand === "register") {
    const options = parseRegisterSkillPackArgs(rest);
    const layout = resolveWorkspaceLayout(options.rootDir);

    await ensureExtensionWorkspaceDirectoryInitialized({
      layout,
      commandName: "skill-pack register",
      directoryPath: layout.skillPacksDir,
      directoryLabel: "skill-packs",
    });

    const result = await registerSkillPack({
      filePath: options.filePath,
      repository: createFileSkillPackRegistryRepository(layout),
    });

    for (const line of formatExtensionSkillPackRegistration(result)) {
      output.writeLine(line);
    }

    return 0;
  }

  if (subcommand === "show") {
    const options = parseShowSkillPackArgs(rest);
    const layout = resolveWorkspaceLayout(options.rootDir);

    await ensureExtensionWorkspaceDirectoryInitialized({
      layout,
      commandName: "skill-pack show",
      directoryPath: layout.skillPacksDir,
      directoryLabel: "skill-packs",
    });

    const skillPack = await readRegisteredSkillPack({
      repository: createFileSkillPackRegistryRepository(layout),
      packRef: options.packRef,
    });

    for (const line of formatExtensionSkillPackShow(skillPack)) {
      output.writeLine(line);
    }

    return 0;
  }

  if (subcommand === "list") {
    const options = parseListSkillPackArgs(rest);
    const layout = resolveWorkspaceLayout(options.rootDir);

    await ensureExtensionWorkspaceDirectoryInitialized({
      layout,
      commandName: "skill-pack list",
      directoryPath: layout.skillPacksDir,
      directoryLabel: "skill-packs",
    });

    const result = await createFileSkillPackRegistryRepository(layout).listAll();

    for (const line of formatExtensionSkillPackList(result)) {
      output.writeLine(line);
    }

    return result.invalid.length > 0 ? 1 : 0;
  }

  output.writeLine(`Commande extension skill-pack inconnue: ${subcommand ?? "(vide)"}`);
  writeHelp(output);
  return 1;
}

function parseValidateExtensionArgs(args: string[]): ValidateExtensionCliOptions {
  const options: Partial<ValidateExtensionCliOptions> = {};

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];

    if (currentArg === "--file") {
      options.filePath = readOptionValue(args, index + 1, "--file");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--file=")) {
      options.filePath = readInlineOptionValue(currentArg, "--file");
      continue;
    }

    throw new Error(`Argument de extension validate inconnu: ${currentArg}`);
  }

  if (!options.filePath?.trim()) {
    throw new Error("L'option --file est obligatoire pour `corp extension validate`.");
  }

  return {
    filePath: options.filePath,
  };
}

function parseRegisterCapabilityArgs(args: string[]): RegisterCapabilityCliOptions {
  const options: Partial<RegisterCapabilityCliOptions> = {};

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];

    if (currentArg === "--root") {
      options.rootDir = readOptionValue(args, index + 1, "--root");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--root=")) {
      options.rootDir = readInlineOptionValue(currentArg, "--root");
      continue;
    }

    if (currentArg === "--file") {
      options.filePath = readOptionValue(args, index + 1, "--file");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--file=")) {
      options.filePath = readInlineOptionValue(currentArg, "--file");
      continue;
    }

    throw new Error(`Argument de extension capability register inconnu: ${currentArg}`);
  }

  if (!options.rootDir?.trim()) {
    throw new Error(
      "L'option --root est obligatoire pour `corp extension capability register`.",
    );
  }

  if (!options.filePath?.trim()) {
    throw new Error(
      "L'option --file est obligatoire pour `corp extension capability register`.",
    );
  }

  return {
    rootDir: options.rootDir,
    filePath: options.filePath,
  };
}

function parseRegisterSkillPackArgs(args: string[]): RegisterSkillPackCliOptions {
  const options: Partial<RegisterSkillPackCliOptions> = {};

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];

    if (currentArg === "--root") {
      options.rootDir = readOptionValue(args, index + 1, "--root");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--root=")) {
      options.rootDir = readInlineOptionValue(currentArg, "--root");
      continue;
    }

    if (currentArg === "--file") {
      options.filePath = readOptionValue(args, index + 1, "--file");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--file=")) {
      options.filePath = readInlineOptionValue(currentArg, "--file");
      continue;
    }

    throw new Error(`Argument de extension skill-pack register inconnu: ${currentArg}`);
  }

  if (!options.rootDir?.trim()) {
    throw new Error(
      "L'option --root est obligatoire pour `corp extension skill-pack register`.",
    );
  }

  if (!options.filePath?.trim()) {
    throw new Error(
      "L'option --file est obligatoire pour `corp extension skill-pack register`.",
    );
  }

  return {
    rootDir: options.rootDir,
    filePath: options.filePath,
  };
}

function parseShowSkillPackArgs(args: string[]): ShowSkillPackCliOptions {
  const options: Partial<ShowSkillPackCliOptions> = {};

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];

    if (currentArg === "--root") {
      options.rootDir = readOptionValue(args, index + 1, "--root");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--root=")) {
      options.rootDir = readInlineOptionValue(currentArg, "--root");
      continue;
    }

    if (currentArg === "--pack-ref") {
      options.packRef = readOptionValue(args, index + 1, "--pack-ref");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--pack-ref=")) {
      options.packRef = readInlineOptionValue(currentArg, "--pack-ref");
      continue;
    }

    throw new Error(`Argument de extension skill-pack show inconnu: ${currentArg}`);
  }

  if (!options.rootDir?.trim()) {
    throw new Error(
      "L'option --root est obligatoire pour `corp extension skill-pack show`.",
    );
  }

  if (!options.packRef?.trim()) {
    throw new Error(
      "L'option --pack-ref est obligatoire pour `corp extension skill-pack show`.",
    );
  }

  return {
    rootDir: options.rootDir,
    packRef: options.packRef,
  };
}

function parseListSkillPackArgs(args: string[]): ListSkillPackCliOptions {
  const options: Partial<ListSkillPackCliOptions> = {};

  for (let index = 0; index < args.length; index += 1) {
    const currentArg = args[index];

    if (currentArg === "--root") {
      options.rootDir = readOptionValue(args, index + 1, "--root");
      index += 1;
      continue;
    }

    if (currentArg.startsWith("--root=")) {
      options.rootDir = readInlineOptionValue(currentArg, "--root");
      continue;
    }

    throw new Error(`Argument de extension skill-pack list inconnu: ${currentArg}`);
  }

  if (!options.rootDir?.trim()) {
    throw new Error(
      "L'option --root est obligatoire pour `corp extension skill-pack list`.",
    );
  }

  return {
    rootDir: options.rootDir,
  };
}

function readOptionValue(args: string[], valueIndex: number, optionName: string): string {
  const value = args[valueIndex];

  if (value === undefined || value.startsWith("--")) {
    throw new Error(`L'option ${optionName} exige une valeur.`);
  }

  return value;
}

function readInlineOptionValue(argument: string, optionName: string): string {
  const value = argument.slice(`${optionName}=`.length);

  if (!value) {
    throw new Error(`L'option ${optionName} exige une valeur.`);
  }

  return value;
}

function writeHelp(output: CliOutput): void {
  for (const line of formatExtensionHelp()) {
    output.writeLine(line);
  }
}

async function ensureExtensionWorkspaceDirectoryInitialized(
  options: {
    layout: ReturnType<typeof resolveWorkspaceLayout>;
    commandName: string;
    directoryPath: string;
    directoryLabel: string;
  },
): Promise<void> {
  const journalAccessError = await readAccessError(options.layout.journalPath);
  const projectionsAccessError = await readAccessError(options.layout.projectionsDir);
  const missionsAccessError = await readAccessError(options.layout.missionsDir);
  const directoryAccessError = await readAccessError(options.directoryPath);
  const accessErrors = [
    journalAccessError,
    projectionsAccessError,
    missionsAccessError,
    directoryAccessError,
  ];

  const permissionError = accessErrors.find((error) => error?.code === "EACCES");

  if (permissionError) {
    throw new Error(
      `Permissions insuffisantes sur le workspace \`${options.layout.rootDir}\` avant \`corp extension ${options.commandName}\`.`,
    );
  }

  const hasLegacyWorkspaceShape = !journalAccessError
    && !projectionsAccessError
    && !missionsAccessError
    && directoryAccessError?.code === "ENOENT";

  if (hasLegacyWorkspaceShape) {
    throw new Error(
      `Le workspace existe mais le repertoire ${options.directoryLabel} n'est pas initialise. Lancez \`corp mission bootstrap --root ${options.layout.rootDir}\` pour le mettre a jour.`,
    );
  }

  if (
    journalAccessError?.code === "ENOENT"
    || projectionsAccessError?.code === "ENOENT"
    || missionsAccessError?.code === "ENOENT"
  ) {
    throw new Error(
      `Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${options.layout.rootDir}\` avant \`corp extension ${options.commandName}\`.`,
    );
  }

  const unexpectedError = accessErrors.find((error) =>
    error !== null && error.code !== "ENOENT" && error.code !== "EACCES"
  );

  if (unexpectedError) {
    throw unexpectedError;
  }
}

async function readAccessError(pathToCheck: string): Promise<NodeJS.ErrnoException | null> {
  try {
    await access(pathToCheck);
    return null;
  } catch (error) {
    if (isErrnoException(error)) {
      return error;
    }

    throw error;
  }
}

function isErrnoException(error: unknown): error is NodeJS.ErrnoException {
  return typeof error === "object" && error !== null && "code" in error;
}
