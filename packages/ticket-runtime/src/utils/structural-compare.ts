import { isDeepStrictEqual } from "node:util";

/**
 * Compare deux valeurs en normalisant l'ordre des cles JSON mais en preservant
 * l'ordre des arrays (dependsOn, eventIds, artifactIds sont ordonnes).
 */
export function deepStrictEqualForComparison(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(
    normalizeValueForComparison(left),
    normalizeValueForComparison(right),
  );
}

/**
 * Compare deux valeurs en triant les arrays de strings avant comparaison.
 * A utiliser uniquement pour les champs semantiquement non-ordonnes
 * (allowedCapabilities, skillPackRefs).
 */
export function deepStrictEqualIgnoringArrayOrder(left: unknown, right: unknown): boolean {
  return isDeepStrictEqual(
    normalizeValueSortingArrays(left),
    normalizeValueSortingArrays(right),
  );
}

function normalizeValueForComparison(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeValueForComparison(item));
  }

  if (typeof value !== "object" || value === null) {
    return value;
  }

  const normalizedRecord: Record<string, unknown> = {};

  for (const key of Object.keys(value as Record<string, unknown>).sort((left, right) =>
    left.localeCompare(right)
  )) {
    normalizedRecord[key] = normalizeValueForComparison(
      (value as Record<string, unknown>)[key],
    );
  }

  return normalizedRecord;
}

function normalizeValueSortingArrays(value: unknown): unknown {
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

  const normalizedRecord: Record<string, unknown> = {};

  for (const key of Object.keys(value as Record<string, unknown>).sort((left, right) =>
    left.localeCompare(right)
  )) {
    normalizedRecord[key] = normalizeValueSortingArrays(
      (value as Record<string, unknown>)[key],
    );
  }

  return normalizedRecord;
}
