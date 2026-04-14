"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTENSION_REGISTRATION_SEAM_TYPES = exports.EXTENSION_REGISTRATION_SCHEMA_VERSION = void 0;
exports.normalizeOpaqueExtensionReference = normalizeOpaqueExtensionReference;
exports.normalizeOpaqueExtensionReferences = normalizeOpaqueExtensionReferences;
exports.EXTENSION_REGISTRATION_SCHEMA_VERSION = "corp.extension.v1";
exports.EXTENSION_REGISTRATION_SEAM_TYPES = [
    "execution_adapter",
    "capability",
    "skill_pack",
];
function normalizeOpaqueExtensionReference(value) {
    return value.trim();
}
function normalizeOpaqueExtensionReferences(values) {
    const normalizedValues = [];
    const seenValues = new Set();
    for (const rawValue of values) {
        const normalizedValue = normalizeOpaqueExtensionReference(rawValue);
        if (!normalizedValue || seenValues.has(normalizedValue)) {
            continue;
        }
        seenValues.add(normalizedValue);
        normalizedValues.push(normalizedValue);
    }
    return normalizedValues;
}
