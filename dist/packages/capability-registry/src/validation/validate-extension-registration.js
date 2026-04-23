"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UNC_UNREACHABLE_ERROR_CODES = void 0;
exports.validateExtensionRegistration = validateExtensionRegistration;
const node_fs_1 = require("node:fs");
const node_path_1 = __importDefault(require("node:path"));
const extension_registration_1 = require("../../../contracts/src/extension/extension-registration");
const LAUNCH_MODES = [
    "foreground_only",
    "background_only",
    "foreground_or_background",
];
const FORBIDDEN_FIELD_RULES = new Map([
    ["marketplace", {
            code: "out_of_scope_field",
            message: "Le contrat V1 refuse toute logique de marketplace ou catalogue distant.",
        }],
    ["pluginHost", {
            code: "out_of_scope_field",
            message: "Le contrat V1 refuse tout host de plugins generaliste.",
        }],
    ["controlPlane", {
            code: "out_of_scope_field",
            message: "Le contrat V1 refuse tout control plane distribue.",
        }],
    ["distributionUrl", {
            code: "out_of_scope_field",
            message: "Le contrat V1 refuse toute distribution distante.",
        }],
    ["installUrl", {
            code: "out_of_scope_field",
            message: "Le contrat V1 refuse toute URL d'installation distante.",
        }],
    ["webhook", {
            code: "out_of_scope_field",
            message: "Le contrat V1 refuse toute logique webhook.",
        }],
    ["responseId", {
            code: "forbidden_field",
            message: "Le contrat public ne doit jamais exposer de details vendor runtime.",
        }],
    ["threadId", {
            code: "forbidden_field",
            message: "Le contrat public ne doit jamais exposer de details vendor runtime.",
        }],
    ["pollCursor", {
            code: "forbidden_field",
            message: "Le contrat public ne doit jamais exposer de details vendor runtime.",
        }],
    ["vendorStatus", {
            code: "forbidden_field",
            message: "Le contrat public ne doit jamais exposer de details vendor runtime.",
        }],
    ["apiKey", {
            code: "forbidden_field",
            message: "Le contrat public ne doit declarer aucun secret en clair.",
        }],
    ["token", {
            code: "forbidden_field",
            message: "Le contrat public ne doit declarer aucun secret en clair.",
        }],
    ["secret", {
            code: "forbidden_field",
            message: "Le contrat public ne doit declarer aucun secret en clair.",
        }],
    ["secretValue", {
            code: "forbidden_field",
            message: "Le contrat public ne doit declarer aucun secret en clair.",
        }],
    ["password", {
            code: "forbidden_field",
            message: "Le contrat public ne doit declarer aucun secret en clair.",
        }],
]);
const FORBIDDEN_LOCAL_REF_PATTERNS = [
    ".codex/config.toml",
    ".codex-plugin/plugin.json",
];
const ENV_NAME_PATTERN = /^[A-Z][A-Z0-9_]*$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;
const WINDOWS_DRIVE_ABSOLUTE_REFERENCE_PATTERN = /^[A-Za-z]:[\\/]/;
const WINDOWS_UNC_ABSOLUTE_REFERENCE_PATTERN = /^[\\/]{2}[^\\/]+[\\/][^\\/]+/;
function validateExtensionRegistration(value, options = {}) {
    const diagnostics = [];
    const baseDir = resolveBaseDir(options);
    if (!isRecord(value)) {
        pushDiagnostic(diagnostics, "invalid_type", "$", "Le manifeste doit etre un objet JSON racine.");
        return buildValidationResult(diagnostics, null, null);
    }
    scanForbiddenFields(value, "", diagnostics);
    const schemaVersion = readRequiredString(value, "schemaVersion", diagnostics);
    const seamType = readSeamType(value, diagnostics);
    const id = readRequiredString(value, "id", diagnostics);
    const displayName = readRequiredString(value, "displayName", diagnostics);
    const version = readVersion(value, diagnostics);
    const permissions = readStringList(value, "permissions", diagnostics);
    const constraints = readStringList(value, "constraints", diagnostics);
    const metadata = readMetadata(value, diagnostics);
    const localRefs = readLocalRefs(value, baseDir, diagnostics);
    if (schemaVersion !== null
        && schemaVersion !== extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION) {
        pushDiagnostic(diagnostics, "unsupported_schema_version", "schemaVersion", `La version de schema doit valoir \`${extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION}\`.`);
    }
    if (schemaVersion === null
        || seamType === null
        || id === null
        || displayName === null
        || version === null
        || permissions === null
        || constraints === null
        || metadata === null
        || localRefs === null) {
        return buildValidationResult(diagnostics, null, null);
    }
    let registration = null;
    if (seamType === "execution_adapter") {
        registration = readExecutionAdapterRegistration(value, {
            schemaVersion: extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION,
            seamType,
            id,
            displayName,
            version,
            permissions,
            constraints,
            metadata,
            localRefs: localRefs.normalized,
        }, diagnostics);
    }
    if (seamType === "capability") {
        registration = readCapabilityRegistration(value, {
            schemaVersion: extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION,
            seamType,
            id,
            displayName,
            version,
            permissions,
            constraints,
            metadata,
            localRefs: localRefs.normalized,
        }, diagnostics);
    }
    if (seamType === "skill_pack") {
        registration = readSkillPackRegistration(value, {
            schemaVersion: extension_registration_1.EXTENSION_REGISTRATION_SCHEMA_VERSION,
            seamType,
            id,
            displayName,
            version,
            permissions,
            constraints,
            metadata,
            localRefs: localRefs.normalized,
        }, diagnostics);
    }
    if (registration === null && diagnostics.length === 0) {
        pushDiagnostic(diagnostics, "internal_error", "seamType", `Le type de seam \`${seamType}\` est reconnu mais aucune branche de traitement n'est implementee.`);
    }
    if (diagnostics.length > 0) {
        return buildValidationResult(diagnostics, null, null);
    }
    return buildValidationResult(diagnostics, registration, localRefs.resolved);
}
function buildValidationResult(diagnostics, registration, resolvedLocalRefs) {
    return {
        ok: diagnostics.length === 0,
        diagnostics,
        registration: diagnostics.length === 0 ? registration : null,
        resolvedLocalRefs: diagnostics.length === 0 ? resolvedLocalRefs : null,
    };
}
function resolveBaseDir(options) {
    if (options.baseDir) {
        return node_path_1.default.resolve(options.baseDir);
    }
    if (options.sourcePath) {
        return node_path_1.default.dirname(node_path_1.default.resolve(options.sourcePath));
    }
    return undefined;
}
function readExecutionAdapterRegistration(value, baseRegistration, diagnostics) {
    ensureExclusiveSeamBlock(value, "execution_adapter", diagnostics);
    const executionAdapter = readExecutionAdapterDetails(value, diagnostics);
    if (executionAdapter === null) {
        return null;
    }
    return {
        ...baseRegistration,
        executionAdapter,
    };
}
function readCapabilityRegistration(value, baseRegistration, diagnostics) {
    ensureExclusiveSeamBlock(value, "capability", diagnostics);
    const capability = readCapabilityDetails(value, baseRegistration.localRefs, diagnostics);
    if (capability === null) {
        return null;
    }
    return {
        ...baseRegistration,
        capability,
    };
}
function readSkillPackRegistration(value, baseRegistration, diagnostics) {
    ensureExclusiveSeamBlock(value, "skill_pack", diagnostics);
    const skillPack = readSkillPackDetails(value, diagnostics);
    if (skillPack === null) {
        return null;
    }
    return {
        ...baseRegistration,
        skillPack,
    };
}
function ensureExclusiveSeamBlock(value, expectedSeamType, diagnostics) {
    const seamBlockByType = {
        execution_adapter: "executionAdapter",
        capability: "capability",
        skill_pack: "skillPack",
    };
    const expectedBlock = seamBlockByType[expectedSeamType];
    for (const [seamType, blockName] of Object.entries(seamBlockByType)) {
        const blockValue = value[blockName];
        if (blockName === expectedBlock && blockValue === undefined) {
            pushDiagnostic(diagnostics, "missing_required_field", blockName, `Le bloc \`${blockName}\` est requis pour \`${seamType}\`.`);
            continue;
        }
        if (blockName !== expectedBlock && blockValue !== undefined) {
            pushDiagnostic(diagnostics, "unexpected_seam_block", blockName, `Le bloc \`${blockName}\` ne peut pas coexister avec \`${expectedBlock}\` dans une declaration V1.`);
        }
    }
}
function readExecutionAdapterDetails(value, diagnostics) {
    const executionAdapter = readRequiredRecord(value, "executionAdapter", diagnostics);
    if (executionAdapter === null) {
        return null;
    }
    const adapterRuntimeId = readRequiredString(executionAdapter, "adapterRuntimeId", diagnostics, "executionAdapter");
    const launchMode = readLaunchMode(executionAdapter, diagnostics);
    const supportsBackground = readRequiredBoolean(executionAdapter, "supportsBackground", diagnostics, "executionAdapter");
    const requiredEnvNames = readEnvNameList(executionAdapter, "requiredEnvNames", diagnostics, "executionAdapter");
    if (adapterRuntimeId === null
        || launchMode === null
        || supportsBackground === null
        || requiredEnvNames === null) {
        return null;
    }
    if (launchMode === "foreground_only" && supportsBackground) {
        pushDiagnostic(diagnostics, "invalid_field_value", "executionAdapter.supportsBackground", "Un adaptateur `foreground_only` ne peut pas declarer `supportsBackground=true`.");
    }
    if ((launchMode === "background_only" || launchMode === "foreground_or_background")
        && !supportsBackground) {
        pushDiagnostic(diagnostics, "invalid_field_value", "executionAdapter.supportsBackground", "Un adaptateur pouvant tourner en background doit declarer `supportsBackground=true`.");
    }
    return {
        adapterRuntimeId: (0, extension_registration_1.normalizeOpaqueExtensionReference)(adapterRuntimeId),
        launchMode,
        supportsBackground,
        requiredEnvNames,
    };
}
function readCapabilityDetails(value, localRefs, diagnostics) {
    const capability = readRequiredRecord(value, "capability", diagnostics);
    if (capability === null) {
        return null;
    }
    const capabilityId = readRequiredString(capability, "capabilityId", diagnostics, "capability");
    const provider = readCapabilityProvider(capability, diagnostics);
    const approvalSensitive = readRequiredBoolean(capability, "approvalSensitive", diagnostics, "capability");
    const requiredEnvNames = readEnvNameList(capability, "requiredEnvNames", diagnostics, "capability");
    if (capabilityId === null
        || provider === null
        || approvalSensitive === null
        || requiredEnvNames === null) {
        return null;
    }
    const registration = {
        capabilityId: (0, extension_registration_1.normalizeOpaqueExtensionReference)(capabilityId),
        provider,
        approvalSensitive,
        requiredEnvNames,
    };
    if (provider === "local" && !localRefs.entrypoint) {
        pushDiagnostic(diagnostics, "missing_required_field", "localRefs.entrypoint", "Une capability locale doit declarer `localRefs.entrypoint`.");
    }
    if (provider === "mcp") {
        const mcpServerName = readRequiredString(capability, "mcpServerName", diagnostics, "capability");
        const mcpToolName = readRequiredString(capability, "mcpToolName", diagnostics, "capability");
        if (mcpServerName === null || mcpToolName === null) {
            return null;
        }
        if (localRefs.entrypoint) {
            pushDiagnostic(diagnostics, "unexpected_field", "localRefs.entrypoint", "Une capability MCP-backed ne doit pas declarer d'entree locale executable.");
        }
        registration.mcpServerName = (0, extension_registration_1.normalizeOpaqueExtensionReference)(mcpServerName);
        registration.mcpToolName = (0, extension_registration_1.normalizeOpaqueExtensionReference)(mcpToolName);
    }
    return registration;
}
function readSkillPackDetails(value, diagnostics) {
    const skillPack = readRequiredRecord(value, "skillPack", diagnostics);
    if (skillPack === null) {
        return null;
    }
    const packRef = readRequiredString(skillPack, "packRef", diagnostics, "skillPack");
    if (packRef === null) {
        return null;
    }
    return {
        packRef: (0, extension_registration_1.normalizeOpaqueExtensionReference)(packRef),
    };
}
function readSeamType(value, diagnostics) {
    const seamType = readRequiredString(value, "seamType", diagnostics);
    if (seamType === null) {
        return null;
    }
    if (extension_registration_1.EXTENSION_REGISTRATION_SEAM_TYPES.includes(seamType)) {
        return seamType;
    }
    pushDiagnostic(diagnostics, "invalid_field_value", "seamType", "Le `seamType` doit valoir `execution_adapter`, `capability` ou `skill_pack`.");
    return null;
}
function readLaunchMode(value, diagnostics) {
    const launchMode = readRequiredString(value, "launchMode", diagnostics, "executionAdapter");
    if (launchMode === null) {
        return null;
    }
    if (LAUNCH_MODES.includes(launchMode)) {
        return launchMode;
    }
    pushDiagnostic(diagnostics, "invalid_field_value", "executionAdapter.launchMode", "Le `launchMode` doit valoir `foreground_only`, `background_only` ou `foreground_or_background`.");
    return null;
}
function readCapabilityProvider(value, diagnostics) {
    const provider = readRequiredString(value, "provider", diagnostics, "capability");
    if (provider === "local" || provider === "mcp") {
        return provider;
    }
    if (provider !== null) {
        pushDiagnostic(diagnostics, "invalid_field_value", "capability.provider", "Le provider d'une capability doit valoir `local` ou `mcp`.");
    }
    return null;
}
function readMetadata(value, diagnostics) {
    const metadata = readRequiredRecord(value, "metadata", diagnostics);
    if (metadata === null) {
        return null;
    }
    const description = readRequiredString(metadata, "description", diagnostics, "metadata");
    const owner = readRequiredString(metadata, "owner", diagnostics, "metadata");
    const tags = readStringList(metadata, "tags", diagnostics, "metadata");
    if (description === null || owner === null || tags === null) {
        return null;
    }
    return {
        ...metadata,
        description,
        owner,
        tags,
    };
}
function readLocalRefs(value, baseDir, diagnostics) {
    const localRefs = readRequiredRecord(value, "localRefs", diagnostics);
    if (localRefs === null) {
        return null;
    }
    const rootDir = readLocalRef(localRefs, "rootDir", diagnostics, {
        parentPath: "localRefs",
        baseDir,
        expectedType: "directory",
        required: true,
    });
    const entrypoint = readLocalRef(localRefs, "entrypoint", diagnostics, {
        parentPath: "localRefs",
        baseDir,
        expectedType: "file",
        required: false,
    });
    const references = readLocalRefList(localRefs, "references", diagnostics, {
        parentPath: "localRefs",
        baseDir,
        expectedType: "any",
    });
    const metadataFile = readLocalRef(localRefs, "metadataFile", diagnostics, {
        parentPath: "localRefs",
        baseDir,
        expectedType: "file",
        required: false,
    });
    const scripts = readLocalRefList(localRefs, "scripts", diagnostics, {
        parentPath: "localRefs",
        baseDir,
        expectedType: "file",
    });
    if (rootDir === null || references === null || scripts === null) {
        return null;
    }
    return {
        normalized: {
            rootDir: rootDir.relativePath,
            ...(entrypoint ? { entrypoint: entrypoint.relativePath } : {}),
            references: references.map((reference) => reference.relativePath),
            ...(metadataFile ? { metadataFile: metadataFile.relativePath } : {}),
            scripts: scripts.map((script) => script.relativePath),
        },
        resolved: {
            rootDir: rootDir.resolvedPath,
            ...(entrypoint ? { entrypoint: entrypoint.resolvedPath } : {}),
            references: references.map((reference) => reference.resolvedPath),
            ...(metadataFile ? { metadataFile: metadataFile.resolvedPath } : {}),
            scripts: scripts.map((script) => script.resolvedPath),
        },
    };
}
function readVersion(value, diagnostics) {
    const version = readRequiredString(value, "version", diagnostics);
    if (version === null) {
        return null;
    }
    if (!SEMVER_PATTERN.test(version)) {
        pushDiagnostic(diagnostics, "invalid_field_value", "version", "La version doit suivre un format semver simple, par exemple `0.1.0`.");
        return null;
    }
    return version;
}
function readEnvNameList(value, key, diagnostics, parentPath) {
    const values = readStringList(value, key, diagnostics, parentPath);
    if (values === null) {
        return null;
    }
    for (const [index, envName] of values.entries()) {
        if (!ENV_NAME_PATTERN.test(envName)) {
            pushDiagnostic(diagnostics, "invalid_field_value", `${parentPath}.${key}[${index}]`, "Les variables d'environnement doivent etre declarees par nom, en MAJUSCULES et sans valeur inline.");
        }
    }
    return values;
}
function readStringList(value, key, diagnostics, parentPath) {
    const fieldPath = buildFieldPath(parentPath, key);
    const rawValue = value[key];
    if (!Array.isArray(rawValue)) {
        pushDiagnostic(diagnostics, rawValue === undefined ? "missing_required_field" : "invalid_type", fieldPath, `Le champ \`${fieldPath}\` doit etre un tableau de chaines.`);
        return null;
    }
    const stringValues = [];
    for (const [index, item] of rawValue.entries()) {
        if (typeof item !== "string") {
            pushDiagnostic(diagnostics, "invalid_type", `${fieldPath}[${index}]`, "Chaque entree doit etre une chaine non vide.");
            continue;
        }
        stringValues.push(item);
    }
    return (0, extension_registration_1.normalizeOpaqueExtensionReferences)(stringValues);
}
function readRequiredBoolean(value, key, diagnostics, parentPath) {
    const fieldPath = buildFieldPath(parentPath, key);
    const rawValue = value[key];
    if (typeof rawValue !== "boolean") {
        pushDiagnostic(diagnostics, rawValue === undefined ? "missing_required_field" : "invalid_type", fieldPath, `Le champ \`${fieldPath}\` doit etre un booleen.`);
        return null;
    }
    return rawValue;
}
function readRequiredString(value, key, diagnostics, parentPath) {
    const fieldPath = buildFieldPath(parentPath, key);
    const rawValue = value[key];
    if (typeof rawValue !== "string") {
        pushDiagnostic(diagnostics, rawValue === undefined ? "missing_required_field" : "invalid_type", fieldPath, `Le champ \`${fieldPath}\` doit etre une chaine non vide.`);
        return null;
    }
    const normalizedValue = (0, extension_registration_1.normalizeOpaqueExtensionReference)(rawValue);
    if (!normalizedValue) {
        pushDiagnostic(diagnostics, "invalid_field_value", fieldPath, `Le champ \`${fieldPath}\` doit etre une chaine non vide.`);
        return null;
    }
    return normalizedValue;
}
function readRequiredRecord(value, key, diagnostics) {
    const rawValue = value[key];
    if (!isRecord(rawValue)) {
        pushDiagnostic(diagnostics, rawValue === undefined ? "missing_required_field" : "invalid_type", key, `Le champ \`${key}\` doit etre un objet.`);
        return null;
    }
    return rawValue;
}
function scanForbiddenFields(value, currentPath, diagnostics) {
    if (Array.isArray(value)) {
        for (const [index, item] of value.entries()) {
            scanForbiddenFields(item, `${currentPath}[${index}]`, diagnostics);
        }
        return;
    }
    if (!isRecord(value)) {
        return;
    }
    for (const [key, nestedValue] of Object.entries(value)) {
        const fieldPath = currentPath ? `${currentPath}.${key}` : key;
        const rule = FORBIDDEN_FIELD_RULES.get(key);
        if (rule) {
            pushDiagnostic(diagnostics, rule.code, fieldPath, rule.message);
        }
        scanForbiddenFields(nestedValue, fieldPath, diagnostics);
    }
}
function readLocalRef(value, key, diagnostics, options) {
    const fieldPath = buildFieldPath(options.parentPath, key);
    const rawValue = value[key];
    if (rawValue === undefined) {
        if (options.required) {
            pushDiagnostic(diagnostics, "missing_required_field", fieldPath, `Le champ \`${fieldPath}\` est obligatoire.`);
        }
        return null;
    }
    if (typeof rawValue !== "string") {
        pushDiagnostic(diagnostics, "invalid_type", fieldPath, `Le champ \`${fieldPath}\` doit etre une ref locale sous forme de chaine.`);
        return null;
    }
    const relativePath = (0, extension_registration_1.normalizeOpaqueExtensionReference)(rawValue);
    if (!relativePath) {
        pushDiagnostic(diagnostics, "invalid_field_value", fieldPath, `Le champ \`${fieldPath}\` doit etre une ref locale non vide.`);
        return null;
    }
    if (isRemoteReference(relativePath) || isAbsoluteReference(relativePath)) {
        pushDiagnostic(diagnostics, "non_local_ref", fieldPath, "Les refs du contrat V1 doivent rester locales et relatives au manifeste.");
        return null;
    }
    if (containsForbiddenLocalRef(relativePath)) {
        pushDiagnostic(diagnostics, "forbidden_local_ref", fieldPath, "Le contrat V1 refuse `.codex/config.toml` et `.codex-plugin/plugin.json`.");
        return null;
    }
    const resolvedPath = options.baseDir
        ? node_path_1.default.resolve(options.baseDir, relativePath)
        : node_path_1.default.resolve(relativePath);
    if (options.baseDir) {
        validateResolvedLocalRef(resolvedPath, fieldPath, options.expectedType, diagnostics);
    }
    return {
        relativePath,
        resolvedPath,
    };
}
function readLocalRefList(value, key, diagnostics, options) {
    const fieldPath = buildFieldPath(options.parentPath, key);
    const rawValue = value[key];
    if (!Array.isArray(rawValue)) {
        pushDiagnostic(diagnostics, rawValue === undefined ? "missing_required_field" : "invalid_type", fieldPath, `Le champ \`${fieldPath}\` doit etre un tableau de refs locales.`);
        return null;
    }
    const results = [];
    const seenPaths = new Set();
    for (const [index, rawItem] of rawValue.entries()) {
        if (typeof rawItem !== "string") {
            pushDiagnostic(diagnostics, "invalid_type", `${fieldPath}[${index}]`, "Chaque ref locale doit etre une chaine.");
            continue;
        }
        const relativePath = (0, extension_registration_1.normalizeOpaqueExtensionReference)(rawItem);
        if (!relativePath || seenPaths.has(relativePath)) {
            continue;
        }
        seenPaths.add(relativePath);
        if (isRemoteReference(relativePath) || isAbsoluteReference(relativePath)) {
            pushDiagnostic(diagnostics, "non_local_ref", `${fieldPath}[${index}]`, "Les refs du contrat V1 doivent rester locales et relatives au manifeste.");
            continue;
        }
        if (containsForbiddenLocalRef(relativePath)) {
            pushDiagnostic(diagnostics, "forbidden_local_ref", `${fieldPath}[${index}]`, "Le contrat V1 refuse `.codex/config.toml` et `.codex-plugin/plugin.json`.");
            continue;
        }
        const resolvedPath = options.baseDir
            ? node_path_1.default.resolve(options.baseDir, relativePath)
            : node_path_1.default.resolve(relativePath);
        if (options.baseDir) {
            validateResolvedLocalRef(resolvedPath, `${fieldPath}[${index}]`, options.expectedType, diagnostics);
        }
        results.push({
            relativePath,
            resolvedPath,
        });
    }
    return results;
}
exports.UNC_UNREACHABLE_ERROR_CODES = new Set([
    "ENOTFOUND",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ETIMEDOUT",
    "ECONNREFUSED",
    "EHOSTDOWN",
]);
function isUncUnreachableError(error) {
    if (typeof error !== "object" || error === null || !("code" in error)) {
        return false;
    }
    const { code } = error;
    return typeof code === "string" && exports.UNC_UNREACHABLE_ERROR_CODES.has(code);
}
function validateResolvedLocalRef(resolvedPath, fieldPath, expectedType, diagnostics) {
    let stats;
    try {
        stats = (0, node_fs_1.statSync)(resolvedPath);
    }
    catch (error) {
        if (looksLikeUncReference(resolvedPath) && isUncUnreachableError(error)) {
            pushDiagnostic(diagnostics, "unc_unreachable", fieldPath, `Le chemin UNC resolu n'est pas joignable: ${resolvedPath}`);
            return;
        }
        pushDiagnostic(diagnostics, "missing_local_ref", fieldPath, `La ref locale resolue n'existe pas: ${resolvedPath}`);
        return;
    }
    if (expectedType === "file" && !stats.isFile()) {
        pushDiagnostic(diagnostics, "invalid_local_ref_type", fieldPath, "La ref locale attendue doit pointer vers un fichier.");
    }
    if (expectedType === "directory" && !stats.isDirectory()) {
        pushDiagnostic(diagnostics, "invalid_local_ref_type", fieldPath, "La ref locale attendue doit pointer vers un dossier.");
    }
}
function isRemoteReference(value) {
    return /^(?:https?|ssh|git|ftp|file):\/\//i.test(value)
        || value.startsWith("git@");
}
function isAbsoluteReference(value) {
    return node_path_1.default.isAbsolute(value)
        || WINDOWS_DRIVE_ABSOLUTE_REFERENCE_PATTERN.test(value)
        || looksLikeUncReference(value);
}
function looksLikeUncReference(value) {
    return WINDOWS_UNC_ABSOLUTE_REFERENCE_PATTERN.test(value);
}
function containsForbiddenLocalRef(value) {
    const normalizedPath = value.replace(/\\/g, "/").toLowerCase();
    return FORBIDDEN_LOCAL_REF_PATTERNS.some((pattern) => normalizedPath.includes(pattern.toLowerCase()));
}
function buildFieldPath(parentPath, key) {
    return parentPath ? `${parentPath}.${key}` : key;
}
function pushDiagnostic(diagnostics, code, fieldPath, message) {
    diagnostics.push({
        code,
        path: fieldPath,
        message,
    });
}
function isRecord(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
