"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runExtensionCommand = runExtensionCommand;
const promises_1 = require("node:fs/promises");
const register_capability_1 = require("../../../../packages/capability-registry/src/registry/register-capability");
const read_registered_skill_pack_1 = require("../../../../packages/skill-pack/src/loader/read-registered-skill-pack");
const register_skill_pack_1 = require("../../../../packages/skill-pack/src/loader/register-skill-pack");
const workspace_layout_1 = require("../../../../packages/storage/src/fs-layout/workspace-layout");
const file_capability_registry_repository_1 = require("../../../../packages/storage/src/repositories/file-capability-registry-repository");
const file_skill_pack_registry_repository_1 = require("../../../../packages/storage/src/repositories/file-skill-pack-registry-repository");
const read_extension_registration_file_1 = require("../../../../packages/capability-registry/src/validation/read-extension-registration-file");
const help_formatter_1 = require("../formatters/help-formatter");
const extension_capability_registration_formatter_1 = require("../formatters/extension-capability-registration-formatter");
const extension_skill_pack_registration_formatter_1 = require("../formatters/extension-skill-pack-registration-formatter");
const extension_skill_pack_show_formatter_1 = require("../formatters/extension-skill-pack-show-formatter");
const extension_validation_formatter_1 = require("../formatters/extension-validation-formatter");
async function runExtensionCommand(args, output) {
    const [subcommand, ...rest] = args;
    if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
        writeHelp(output);
        return 0;
    }
    if (subcommand === "validate") {
        const options = parseValidateExtensionArgs(rest);
        const result = await (0, read_extension_registration_file_1.readExtensionRegistrationFile)(options.filePath);
        for (const line of (0, extension_validation_formatter_1.formatExtensionValidation)(result)) {
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
async function runCapabilityExtensionCommand(args, output) {
    const [subcommand, ...rest] = args;
    if (subcommand === "register") {
        const options = parseRegisterCapabilityArgs(rest);
        const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
        await ensureExtensionWorkspaceDirectoryInitialized({
            layout,
            commandName: "capability register",
            directoryPath: layout.capabilitiesDir,
            directoryLabel: "capabilities",
        });
        const result = await (0, register_capability_1.registerCapability)({
            filePath: options.filePath,
            repository: (0, file_capability_registry_repository_1.createFileCapabilityRegistryRepository)(layout),
        });
        for (const line of (0, extension_capability_registration_formatter_1.formatExtensionCapabilityRegistration)(result)) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande extension capability inconnue: ${subcommand ?? "(vide)"}`);
    writeHelp(output);
    return 1;
}
async function runSkillPackExtensionCommand(args, output) {
    const [subcommand, ...rest] = args;
    if (subcommand === "register") {
        const options = parseRegisterSkillPackArgs(rest);
        const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
        await ensureExtensionWorkspaceDirectoryInitialized({
            layout,
            commandName: "skill-pack register",
            directoryPath: layout.skillPacksDir,
            directoryLabel: "skill-packs",
        });
        const result = await (0, register_skill_pack_1.registerSkillPack)({
            filePath: options.filePath,
            repository: (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout),
        });
        for (const line of (0, extension_skill_pack_registration_formatter_1.formatExtensionSkillPackRegistration)(result)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (subcommand === "show") {
        const options = parseShowSkillPackArgs(rest);
        const layout = (0, workspace_layout_1.resolveWorkspaceLayout)(options.rootDir);
        await ensureExtensionWorkspaceDirectoryInitialized({
            layout,
            commandName: "skill-pack show",
            directoryPath: layout.skillPacksDir,
            directoryLabel: "skill-packs",
        });
        const skillPack = await (0, read_registered_skill_pack_1.readRegisteredSkillPack)({
            repository: (0, file_skill_pack_registry_repository_1.createFileSkillPackRegistryRepository)(layout),
            packRef: options.packRef,
        });
        for (const line of (0, extension_skill_pack_show_formatter_1.formatExtensionSkillPackShow)(skillPack)) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande extension skill-pack inconnue: ${subcommand ?? "(vide)"}`);
    writeHelp(output);
    return 1;
}
function parseValidateExtensionArgs(args) {
    const options = {};
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
function parseRegisterCapabilityArgs(args) {
    const options = {};
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
        throw new Error("L'option --root est obligatoire pour `corp extension capability register`.");
    }
    if (!options.filePath?.trim()) {
        throw new Error("L'option --file est obligatoire pour `corp extension capability register`.");
    }
    return {
        rootDir: options.rootDir,
        filePath: options.filePath,
    };
}
function parseRegisterSkillPackArgs(args) {
    const options = {};
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
        throw new Error("L'option --root est obligatoire pour `corp extension skill-pack register`.");
    }
    if (!options.filePath?.trim()) {
        throw new Error("L'option --file est obligatoire pour `corp extension skill-pack register`.");
    }
    return {
        rootDir: options.rootDir,
        filePath: options.filePath,
    };
}
function parseShowSkillPackArgs(args) {
    const options = {};
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
        throw new Error("L'option --root est obligatoire pour `corp extension skill-pack show`.");
    }
    if (!options.packRef?.trim()) {
        throw new Error("L'option --pack-ref est obligatoire pour `corp extension skill-pack show`.");
    }
    return {
        rootDir: options.rootDir,
        packRef: options.packRef,
    };
}
function readOptionValue(args, valueIndex, optionName) {
    const value = args[valueIndex];
    if (value === undefined || value.startsWith("--")) {
        throw new Error(`L'option ${optionName} exige une valeur.`);
    }
    return value;
}
function readInlineOptionValue(argument, optionName) {
    const value = argument.slice(`${optionName}=`.length);
    if (!value) {
        throw new Error(`L'option ${optionName} exige une valeur.`);
    }
    return value;
}
function writeHelp(output) {
    for (const line of (0, help_formatter_1.formatExtensionHelp)()) {
        output.writeLine(line);
    }
}
async function ensureExtensionWorkspaceDirectoryInitialized(options) {
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
        throw new Error(`Permissions insuffisantes sur le workspace \`${options.layout.rootDir}\` avant \`corp extension ${options.commandName}\`.`);
    }
    const hasLegacyWorkspaceShape = !journalAccessError
        && !projectionsAccessError
        && !missionsAccessError
        && directoryAccessError?.code === "ENOENT";
    if (hasLegacyWorkspaceShape) {
        throw new Error(`Le workspace existe mais le repertoire ${options.directoryLabel} n'est pas initialise. Lancez \`corp mission bootstrap --root ${options.layout.rootDir}\` pour le mettre a jour.`);
    }
    if (journalAccessError?.code === "ENOENT"
        || projectionsAccessError?.code === "ENOENT"
        || missionsAccessError?.code === "ENOENT") {
        throw new Error(`Workspace mission non initialise. Lancez \`corp mission bootstrap --root ${options.layout.rootDir}\` avant \`corp extension ${options.commandName}\`.`);
    }
    const unexpectedError = accessErrors.find((error) => error !== null && error.code !== "ENOENT" && error.code !== "EACCES");
    if (unexpectedError) {
        throw unexpectedError;
    }
}
async function readAccessError(pathToCheck) {
    try {
        await (0, promises_1.access)(pathToCheck);
        return null;
    }
    catch (error) {
        if (isErrnoException(error)) {
            return error;
        }
        throw error;
    }
}
function isErrnoException(error) {
    return typeof error === "object" && error !== null && "code" in error;
}
