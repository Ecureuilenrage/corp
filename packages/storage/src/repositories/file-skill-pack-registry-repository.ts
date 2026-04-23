import type { Dirent } from "node:fs";
import { mkdir, readdir, rm, writeFile } from "node:fs/promises";

import { validateRegisteredSkillPack } from "../../../contracts/src/guards/persisted-document-guards";
import { normalizeOpaqueReferenceKey } from "../../../contracts/src/extension/extension-registration";
import type { RegisteredSkillPack } from "../../../contracts/src/extension/registered-skill-pack";
import { deepStrictEqualForComparison } from "../../../ticket-runtime/src/utils/structural-compare";
import { isAlreadyExistsError, writeJsonAtomic } from "../fs-layout/atomic-json";
import { isMissingFileError } from "../fs-layout/file-system-read-errors";
import {
  resolveSkillPackStoragePaths,
  type WorkspaceLayout,
} from "../fs-layout/workspace-layout";
import {
  assertValidPersistedDocument,
  isPersistedDocumentReadError,
  readPersistedJsonDocument,
} from "./persisted-document-errors";

export interface SaveRegisteredSkillPackResult {
  status: "registered" | "unchanged";
  skillPackDir: string;
  skillPackPath: string;
  registeredSkillPack: RegisteredSkillPack;
}

export interface SkillPackRegistryReader {
  findByPackRef(packRef: string): Promise<RegisteredSkillPack | null>;
}

export interface SkillPackListDiagnostic {
  packRef: string;
  filePath: string;
  code: string;
  message: string;
  error: Error;
}

export interface SkillPackRegistryRepository extends SkillPackRegistryReader {
  save(registeredSkillPack: RegisteredSkillPack): Promise<SaveRegisteredSkillPackResult>;
  listAll(): Promise<{ valid: RegisteredSkillPack[]; invalid: SkillPackListDiagnostic[] }>;
  list(): Promise<RegisteredSkillPack[]>;
}

export class FileSkillPackRegistryRepository implements SkillPackRegistryRepository {
  public constructor(private readonly layout: WorkspaceLayout) {}

  public async save(
    registeredSkillPack: RegisteredSkillPack,
  ): Promise<SaveRegisteredSkillPackResult> {
    const skillPackStoragePaths = resolveSkillPackStoragePaths(
      this.layout,
      registeredSkillPack.packRef,
    );
    const existingSkillPack = await this.findByPackRef(
      registeredSkillPack.packRef,
    );

    if (existingSkillPack) {
      if (hasCaseCollision(
        existingSkillPack.packRef,
        registeredSkillPack.packRef,
      )) {
        throw new Error(
          `Collision de casse detectee pour le skill pack \`${registeredSkillPack.packRef}\`: deja enregistre comme \`${existingSkillPack.packRef}\`.`,
        );
      }

      if (
        deepStrictEqualForComparison(
          toComparableRegisteredSkillPack(existingSkillPack),
          toComparableRegisteredSkillPack(registeredSkillPack),
        )
      ) {
        return {
          status: "unchanged",
          skillPackDir: skillPackStoragePaths.skillPackDir,
          skillPackPath: skillPackStoragePaths.skillPackPath,
          registeredSkillPack: existingSkillPack,
        };
      }

      throw new Error(
        `Collision ambigue pour le skill pack \`${registeredSkillPack.packRef}\`: une autre registration existe deja.`,
      );
    }

    await mkdir(this.layout.skillPacksDir, { recursive: true });

    try {
      await mkdir(skillPackStoragePaths.skillPackDir, { recursive: false });
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        return await resolveConcurrentSkillPackRegistration(
          this,
          skillPackStoragePaths,
          registeredSkillPack,
        );
      }

      throw error;
    }

    try {
      await writeJsonAtomic(skillPackStoragePaths.skillPackPath, registeredSkillPack);
    } catch (error) {
      try {
        await rm(skillPackStoragePaths.skillPackDir, { recursive: true, force: true });
      } catch {
        // Best-effort cleanup du repertoire orphelin.
      }

      throw error;
    }

    return {
      status: "registered",
      skillPackDir: skillPackStoragePaths.skillPackDir,
      skillPackPath: skillPackStoragePaths.skillPackPath,
      registeredSkillPack,
    };
  }

  public async findByPackRef(packRef: string): Promise<RegisteredSkillPack | null> {
    const skillPackStoragePaths = resolveSkillPackStoragePaths(this.layout, packRef);
    const context = {
      filePath: skillPackStoragePaths.skillPackPath,
      entityLabel: "RegisteredSkillPack",
      corruptionLabel: "fichier de registre corrompu pour le skill pack",
      documentId: packRef,
    };

    try {
      const storedSkillPack = await readPersistedJsonDocument(context);
      assertValidPersistedDocument<RegisteredSkillPack>(
        storedSkillPack,
        validateRegisteredSkillPack,
        context,
      );
      return storedSkillPack;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      throw error;
    }
  }

  public async listAll(): Promise<{ valid: RegisteredSkillPack[]; invalid: SkillPackListDiagnostic[] }> {
    const skillPackEntries = await readDirectoryEntries(this.layout.skillPacksDir);
    const valid: RegisteredSkillPack[] = [];
    const invalid: SkillPackListDiagnostic[] = [];

    for (const skillPackEntry of skillPackEntries) {
      if (!skillPackEntry.isDirectory()) {
        continue;
      }

      try {
        const skillPack = await this.findByPackRef(skillPackEntry.name);

        if (skillPack) {
          valid.push(skillPack);
        }
      } catch (error) {
        if (!isPersistedDocumentReadError(error)) {
          throw error;
        }

        invalid.push({
          packRef: skillPackEntry.name,
          filePath: error.filePath,
          code: error.code,
          message: error.message,
          error,
        });
      }
    }

    return {
      valid: valid.sort((left, right) => left.packRef.localeCompare(right.packRef)),
      invalid: invalid.sort((left, right) => left.packRef.localeCompare(right.packRef)),
    };
  }

  public async list(): Promise<RegisteredSkillPack[]> {
    // Deprecated: utilisez `listAll()` pour obtenir les diagnostics multi-pack
    // sans masquer les enregistrements valides.
    const result = await this.listAll();

    if (result.invalid.length > 0) {
      throw result.invalid[0].error;
    }

    return result.valid;
  }
}

export function createFileSkillPackRegistryRepository(
  layout: WorkspaceLayout,
): FileSkillPackRegistryRepository {
  return new FileSkillPackRegistryRepository(layout);
}

function toComparableRegisteredSkillPack(
  registeredSkillPack: RegisteredSkillPack,
): Omit<RegisteredSkillPack, "registeredAt"> {
  const { registeredAt: _registeredAt, ...comparableSkillPack } = registeredSkillPack;
  return comparableSkillPack;
}

function hasCaseCollision(existingValue: string, requestedValue: string): boolean {
  return existingValue !== requestedValue
    && normalizeOpaqueReferenceKey(existingValue)
      === normalizeOpaqueReferenceKey(requestedValue);
}

async function resolveConcurrentSkillPackRegistration(
  repository: FileSkillPackRegistryRepository,
  skillPackStoragePaths: ReturnType<typeof resolveSkillPackStoragePaths>,
  registeredSkillPack: RegisteredSkillPack,
): Promise<SaveRegisteredSkillPackResult> {
  const existingSkillPack = await waitForConcurrentSkillPackWrite(
    repository,
    registeredSkillPack.packRef,
  );

  if (existingSkillPack) {
    return resolveAgainstExistingRegistration(
      skillPackStoragePaths,
      registeredSkillPack,
      existingSkillPack,
    );
  }

  // La fenetre de polling est expiree sans qu'un writer concurrent n'ait publie le
  // manifeste : soit le processus gagnant est mort apres mkdir, soit il est toujours
  // en vol mais au-dela du budget. On tente un claim atomique du manifeste cible avec
  // flag wx ; un rename atomique classique pourrait remplacer un manifeste concurrent
  // arrive entre la fin du polling et le claim.
  try {
    await writeRegisteredSkillPackIfMissing(
      skillPackStoragePaths.skillPackPath,
      registeredSkillPack,
    );

    return {
      status: "registered",
      skillPackDir: skillPackStoragePaths.skillPackDir,
      skillPackPath: skillPackStoragePaths.skillPackPath,
      registeredSkillPack,
    };
  } catch (error) {
    if (!isAlreadyExistsError(error)) {
      throw error;
    }
  }

  const racedSkillPack = await repository.findByPackRef(registeredSkillPack.packRef);

  if (racedSkillPack) {
    return resolveAgainstExistingRegistration(
      skillPackStoragePaths,
      registeredSkillPack,
      racedSkillPack,
    );
  }

  throw new Error(
    `Dir orpheline non revendiquable pour le skill pack \`${registeredSkillPack.packRef}\`: aucun manifeste publie et le claim atomique a echoue.`,
  );
}

function resolveAgainstExistingRegistration(
  skillPackStoragePaths: ReturnType<typeof resolveSkillPackStoragePaths>,
  registeredSkillPack: RegisteredSkillPack,
  existingSkillPack: RegisteredSkillPack,
): SaveRegisteredSkillPackResult {
  if (
    deepStrictEqualForComparison(
      toComparableRegisteredSkillPack(existingSkillPack),
      toComparableRegisteredSkillPack(registeredSkillPack),
    )
  ) {
    return {
      status: "unchanged",
      skillPackDir: skillPackStoragePaths.skillPackDir,
      skillPackPath: skillPackStoragePaths.skillPackPath,
      registeredSkillPack: existingSkillPack,
    };
  }

  throw new Error(
    `Conflit d'ecriture concurrente legitime pour le skill pack \`${registeredSkillPack.packRef}\`: un manifeste different a ete publie par un writer concurrent.`,
  );
}

// Budget total ~500ms avec backoff exponentiel plafonne, afin d'absorber les writers
// concurrents qui mettent plus de 50ms a publier (anciennement 5 x 10ms, trop serre).
const CONCURRENT_WRITE_INITIAL_DELAY_MS = 10;
const CONCURRENT_WRITE_MAX_DELAY_MS = 160;
const CONCURRENT_WRITE_TOTAL_BUDGET_MS = 500;

async function waitForConcurrentSkillPackWrite(
  repository: FileSkillPackRegistryRepository,
  packRef: string,
): Promise<RegisteredSkillPack | null> {
  let elapsedMs = 0;
  let nextDelayMs = CONCURRENT_WRITE_INITIAL_DELAY_MS;

  while (elapsedMs < CONCURRENT_WRITE_TOTAL_BUDGET_MS) {
    const existingSkillPack = await repository.findByPackRef(packRef);

    if (existingSkillPack) {
      return existingSkillPack;
    }

    const remainingBudgetMs = CONCURRENT_WRITE_TOTAL_BUDGET_MS - elapsedMs;
    const sleepMs = Math.min(nextDelayMs, remainingBudgetMs);
    await delay(sleepMs);

    elapsedMs += sleepMs;
    nextDelayMs = Math.min(nextDelayMs * 2, CONCURRENT_WRITE_MAX_DELAY_MS);
  }

  return null;
}

async function delay(durationMs: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, durationMs);
  });
}

async function writeRegisteredSkillPackIfMissing(
  skillPackPath: string,
  registeredSkillPack: RegisteredSkillPack,
): Promise<void> {
  await writeFile(
    skillPackPath,
    `${JSON.stringify(registeredSkillPack, null, 2)}\n`,
    { encoding: "utf8", flag: "wx" },
  );
}

async function readDirectoryEntries(directoryPath: string): Promise<Dirent[]> {
  try {
    return await readdir(directoryPath, { withFileTypes: true, encoding: "utf8" });
  } catch (error) {
    if (isMissingFileError(error)) {
      return [];
    }

    throw error;
  }
}
