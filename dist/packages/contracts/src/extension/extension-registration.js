"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXTENSION_REGISTRATION_SEAM_TYPES = exports.EXTENSION_REGISTRATION_SCHEMA_VERSION = void 0;
exports.normalizeOpaqueExtensionReference = normalizeOpaqueExtensionReference;
exports.normalizeOpaqueReferenceKey = normalizeOpaqueReferenceKey;
exports.normalizeOpaqueReferences = normalizeOpaqueReferences;
exports.normalizeOpaqueExtensionReferences = normalizeOpaqueExtensionReferences;
exports.EXTENSION_REGISTRATION_SCHEMA_VERSION = "corp.extension.v1";
exports.EXTENSION_REGISTRATION_SEAM_TYPES = [
    "execution_adapter",
    "capability",
    "skill_pack",
];
const INVISIBLE_TRIM_PATTERN = /^[\s\uFEFF\u00A0\u200B-\u200F\u2028\u2029]+|[\s\uFEFF\u00A0\u200B-\u200F\u2028\u2029]+$/g;
function normalizeOpaqueExtensionReference(value) {
    return value.replace(INVISIBLE_TRIM_PATTERN, "");
}
/**
 * Cle canonique utilisee pour la comparaison case-insensitive des references
 * opaques entre registre, mission et ticket. La chaine est:
 *  1. debarrasee des blancs invisibles (espaces ASCII, BOM U+FEFF, NBSP U+00A0,
 *     ZWSP/ZWJ/ZWNJ U+200B-U+200F, separateurs de ligne U+2028/U+2029) en tete/queue;
 *  2. normalisee en NFC pour eviter les divergences entre formes decomposees et composees;
 *  3. abaissee via `toLocaleLowerCase("en-US")`: la locale `en-US` est choisie pour offrir
 *     un casefold ASCII deterministe independant de la locale systeme (notamment pour eviter
 *     la transformation `I` -> `ı` d'une locale `tr-TR`).
 */
function normalizeOpaqueReferenceKey(value) {
    return normalizeOpaqueExtensionReference(value)
        .normalize("NFC")
        .toLocaleLowerCase("en-US");
}
/**
 * Contrat canonique des references opaques partagees entre registre et runtime:
 * trim etendu (blancs Unicode invisibles inclus), normalisation Unicode NFC, suppression
 * des vides, deduplication stable et preservation de l'ordre. Les refs capability / skill
 * pack peuvent activer `caseInsensitive` pour obtenir une cle canonique comparable entre
 * Windows et POSIX; dans ce mode la valeur retournee est la cle canonique (lowercase).
 */
function normalizeOpaqueReferences(values, options = {}) {
    const normalizedValues = [];
    const seenValues = new Set();
    for (const rawValue of values) {
        const normalizedValue = normalizeOpaqueExtensionReference(rawValue).normalize("NFC");
        const comparisonKey = options.caseInsensitive
            ? normalizeOpaqueReferenceKey(normalizedValue)
            : normalizedValue;
        if (!comparisonKey || seenValues.has(comparisonKey)) {
            continue;
        }
        seenValues.add(comparisonKey);
        normalizedValues.push(comparisonKey);
    }
    return normalizedValues;
}
function normalizeOpaqueExtensionReferences(values, options = {}) {
    return normalizeOpaqueReferences(values, options);
}
