"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deepStrictEqualForComparison = deepStrictEqualForComparison;
exports.deepStrictEqualIgnoringArrayOrder = deepStrictEqualIgnoringArrayOrder;
const node_util_1 = require("node:util");
/**
 * Compare deux valeurs en normalisant l'ordre des cles JSON mais en preservant
 * l'ordre des arrays (dependsOn, eventIds, artifactIds sont ordonnes).
 */
function deepStrictEqualForComparison(left, right) {
    return (0, node_util_1.isDeepStrictEqual)(normalizeValueForComparison(left), normalizeValueForComparison(right));
}
/**
 * Compare deux valeurs en triant les arrays de strings avant comparaison.
 * A utiliser uniquement pour les champs semantiquement non-ordonnes
 * (allowedCapabilities, skillPackRefs).
 */
function deepStrictEqualIgnoringArrayOrder(left, right) {
    return (0, node_util_1.isDeepStrictEqual)(normalizeValueSortingArrays(left), normalizeValueSortingArrays(right));
}
function normalizeValueForComparison(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeValueForComparison(item));
    }
    if (typeof value !== "object" || value === null) {
        return value;
    }
    const normalizedRecord = {};
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
        normalizedRecord[key] = normalizeValueForComparison(value[key]);
    }
    return normalizedRecord;
}
function normalizeValueSortingArrays(value) {
    if (Array.isArray(value)) {
        const normalizedItems = value.map((item) => normalizeValueSortingArrays(item));
        if (normalizedItems.every((item) => typeof item === "string")) {
            return [...normalizedItems].sort((left, right) => left.localeCompare(right));
        }
        return normalizedItems;
    }
    if (typeof value !== "object" || value === null) {
        return value;
    }
    const normalizedRecord = {};
    for (const key of Object.keys(value).sort((left, right) => left.localeCompare(right))) {
        normalizedRecord[key] = normalizeValueSortingArrays(value[key]);
    }
    return normalizedRecord;
}
