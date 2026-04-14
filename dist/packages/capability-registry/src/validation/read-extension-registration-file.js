"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.readExtensionRegistrationFile = readExtensionRegistrationFile;
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const validate_extension_registration_1 = require("./validate-extension-registration");
async function readExtensionRegistrationFile(filePath) {
    const resolvedFilePath = node_path_1.default.resolve(filePath);
    let fileContents;
    try {
        fileContents = await (0, promises_1.readFile)(resolvedFilePath, "utf8");
    }
    catch (error) {
        return {
            filePath: resolvedFilePath,
            ok: false,
            diagnostics: [
                buildDiagnostic("missing_file", "$", error instanceof Error
                    ? `Impossible de lire le manifeste: ${error.message}`
                    : "Impossible de lire le manifeste."),
            ],
            registration: null,
            resolvedLocalRefs: null,
        };
    }
    let parsedManifest;
    try {
        parsedManifest = JSON.parse(fileContents);
    }
    catch (error) {
        return {
            filePath: resolvedFilePath,
            ok: false,
            diagnostics: [
                buildDiagnostic("invalid_json", "$", error instanceof Error
                    ? `Le fichier n'est pas un JSON valide: ${error.message}`
                    : "Le fichier n'est pas un JSON valide."),
            ],
            registration: null,
            resolvedLocalRefs: null,
        };
    }
    return {
        filePath: resolvedFilePath,
        ...(0, validate_extension_registration_1.validateExtensionRegistration)(parsedManifest, {
            sourcePath: resolvedFilePath,
        }),
    };
}
function buildDiagnostic(code, fieldPath, message) {
    return {
        code,
        path: fieldPath,
        message,
    };
}
