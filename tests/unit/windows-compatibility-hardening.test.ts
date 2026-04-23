import assert from "node:assert/strict";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  validateExtensionRegistration,
} from "../../packages/capability-registry/src/validation/validate-extension-registration";
import { normalizeMissionAuthorizedExtensions, type Mission } from "../../packages/contracts/src/mission/mission";
import {
  resolveCapabilityStoragePaths,
  resolveMissionStoragePaths,
  resolveSkillPackStoragePaths,
  resolveWorkspaceLayout,
} from "../../packages/storage/src/fs-layout/workspace-layout";
import {
  ensureTicketExtensionsAllowedByMission,
} from "../../packages/ticket-runtime/src/ticket-service/ticket-service-support";

function createMission(overrides: Partial<Mission> = {}): Mission {
  return {
    id: "mission_windows",
    title: "Mission Windows",
    objective: "Durcir la compatibilite Windows",
    status: "ready",
    successCriteria: ["Les refs restent deterministes"],
    policyProfileId: "policy_profile_windows",
    authorizedExtensions: normalizeMissionAuthorizedExtensions({
      allowedCapabilities: ["Shell.Exec"],
      skillPackRefs: ["Pack.Triage.Local"],
    }),
    ticketIds: [],
    artifactIds: [],
    eventIds: ["event_windows_0"],
    resumeCursor: "event_windows_0",
    createdAt: "2026-04-20T22:00:00.000Z",
    updatedAt: "2026-04-20T22:00:00.000Z",
    ...overrides,
  };
}

function mixCase(value: string): string {
  return [...value]
    .map((character, index) =>
      /[A-Za-z]/.test(character)
        ? (index % 2 === 0 ? character.toLowerCase() : character.toUpperCase())
        : character
    )
    .join("");
}

test("resolve*StoragePaths rejettent les caracteres interdits Windows avec un motif explicite", () => {
  const layout = resolveWorkspaceLayout(path.join(tmpdir(), "corp-windows-layout"));
  const invalidCharacters = [":", "<", ">", "|", "?", "*", "\"", "\0"];

  for (const character of invalidCharacters) {
    assert.throws(
      () => resolveCapabilityStoragePaths(layout, `cap${character}id`),
      /caractere interdit Windows/i,
      `Le caractere ${JSON.stringify(character)} devrait etre rejete.`,
    );
  }

  assert.throws(
    () => resolveMissionStoragePaths(layout, "mission. "),
    /espace ou point terminal/i,
  );
  assert.throws(
    () => resolveSkillPackStoragePaths(layout, "pack.triage."),
    /espace ou point terminal/i,
  );
});

test("resolve*StoragePaths rejettent chaque nom reserve Windows avec ou sans extension et en casse mixte", () => {
  const layout = resolveWorkspaceLayout(path.join(tmpdir(), "corp-windows-reserved-layout"));
  const reservedNames = [
    "CON",
    "PRN",
    "NUL",
    "AUX",
    "COM1",
    "COM2",
    "COM3",
    "COM4",
    "COM5",
    "COM6",
    "COM7",
    "COM8",
    "COM9",
    "LPT1",
    "LPT2",
    "LPT3",
    "LPT4",
    "LPT5",
    "LPT6",
    "LPT7",
    "LPT8",
    "LPT9",
  ];

  for (const reservedName of reservedNames) {
    for (const candidate of [
      reservedName,
      `${reservedName}.txt`,
      mixCase(reservedName),
      `${mixCase(reservedName)}.log`,
    ]) {
      assert.throws(
        () => resolveCapabilityStoragePaths(layout, candidate),
        /nom reserve Windows/i,
        `Le nom reserve ${candidate} devrait etre rejete.`,
      );
    }
  }

  assert.throws(
    () => resolveMissionStoragePaths(layout, "con"),
    /Identifiant de mission invalide.*nom reserve Windows/i,
  );
  assert.throws(
    () => resolveSkillPackStoragePaths(layout, "AuX.md"),
    /Identifiant de skill pack invalide.*nom reserve Windows/i,
  );
});

test("resolve*StoragePaths rejettent les caracteres de controle ASCII en citant leur code point", () => {
  const layout = resolveWorkspaceLayout(path.join(tmpdir(), "corp-windows-control"));
  const controlSamples: Array<{ character: string; codePoint: string }> = [
    { character: "\t", codePoint: "x09" },
    { character: "\n", codePoint: "x0A" },
    { character: "\r", codePoint: "x0D" },
    { character: "\x01", codePoint: "x01" },
    { character: "\x1F", codePoint: "x1F" },
  ];

  for (const { character, codePoint } of controlSamples) {
    assert.throws(
      () => resolveCapabilityStoragePaths(layout, `cap${character}id`),
      new RegExp(`caractere de controle interdit.*\\\\${codePoint}`, "i"),
      `Le caractere de controle \\\\${codePoint} devrait etre rejete.`,
    );
  }
});

// Comportement attendu identique sur Windows et POSIX: AC1 est applique en amont du FS,
// donc la validation ne depend pas du separateur ni de la sensibilite de casse du noyau.
test("assertSafeStorageIdentifier rejette `..` seul mais tolere un double point au milieu d'un identifiant", () => {
  const layout = resolveWorkspaceLayout(path.join(tmpdir(), "corp-windows-dotdot"));

  assert.throws(
    () => resolveMissionStoragePaths(layout, ".."),
    /segment relatif ou separateur interdit/i,
  );

  assert.doesNotThrow(() =>
    resolveSkillPackStoragePaths(layout, "pack..triage"),
  );
});

// AC4 — la discrimination unc_unreachable vs missing_local_ref est pilotee par le code
// d'erreur retourne par statSync (voir UNC_UNREACHABLE_ERROR_CODES). Le test unitaire
// `UNC_UNREACHABLE_ERROR_CODES contient les codes reseau ...` dans
// extension-registration-validation.test.ts couvre la matrice exhaustive sans dependance OS.

test("ensureTicketExtensionsAllowedByMission compare les refs de ticket et mission sans faux negatif de casse", () => {
  const mission = createMission();

  assert.doesNotThrow(() =>
    ensureTicketExtensionsAllowedByMission({
      mission,
      allowedCapabilities: ["shell.exec", "FS.READ", "CLI.RUN"],
      skillPackRefs: ["pack.triage.local"],
    })
  );

  assert.throws(
    () =>
      ensureTicketExtensionsAllowedByMission({
        mission,
        allowedCapabilities: ["shell.write"],
        skillPackRefs: [],
      }),
    /La capability `shell\.write` n'est pas autorisee par la mission `mission_windows`\./i,
  );
});
