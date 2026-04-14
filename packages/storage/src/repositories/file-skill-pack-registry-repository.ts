import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, unlink, writeFile } from "node:fs/promises";

import type { RegisteredSkillPack } from "../../../contracts/src/extension/registered-skill-pack";
import {
  resolveSkillPackStoragePaths,
  type WorkspaceLayout,
} from "../fs-layout/workspace-layout";
import { deepStrictEqualForComparison } from "../../../ticket-runtime/src/utils/structural-compare";

export interface SaveRegisteredSkillPackResult {
  status: "registered" | "unchanged";
  skillPackDir: string;
  skillPackPath: string;
  registeredSkillPack: RegisteredSkillPack;
}

export interface SkillPackRegistryReader {
  findByPackRef(packRef: string): Promise<RegisteredSkillPack | null>;
}

export interface SkillPackRegistryRepository extends SkillPackRegistryReader {
  save(registeredSkillPack: RegisteredSkillPack): Promise<SaveRegisteredSkillPackResult>;
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
      await mkdir(skillPackStoragePaths.skillPackDir);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        throw new Error(
          `Enregistrement concurrent detecte pour le skill pack \`${registeredSkillPack.packRef}\`.`,
        );
      }

      throw error;
    }

    const temporarySkillPackPath = `${skillPackStoragePaths.skillPackPath}.tmp`;

    try {
      await writeFile(
        temporarySkillPackPath,
        `${JSON.stringify(registeredSkillPack, null, 2)}\n`,
        "utf8",
      );
      await rename(temporarySkillPackPath, skillPackStoragePaths.skillPackPath);
    } catch (error) {
      try {
        await cleanupTemporarySkillPackFile(temporarySkillPackPath);
      } catch {
        // Best-effort cleanup du fichier temporaire.
      }

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

    try {
      const storedSkillPack = await readFile(skillPackStoragePaths.skillPackPath, "utf8");
      return JSON.parse(storedSkillPack) as RegisteredSkillPack;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      if (error instanceof SyntaxError) {
        throw new Error(
          `Fichier de registre corrompu pour le skill pack \`${packRef}\`.`,
        );
      }

      throw error;
    }
  }

  public async list(): Promise<RegisteredSkillPack[]> {
    const skillPackEntries = await readDirectoryEntries(this.layout.skillPacksDir);
    const skillPacks: RegisteredSkillPack[] = [];

    for (const skillPackEntry of skillPackEntries) {
      if (!skillPackEntry.isDirectory()) {
        continue;
      }

      try {
        const skillPack = await this.findByPackRef(skillPackEntry.name);

        if (skillPack) {
          skillPacks.push(skillPack);
        }
      } catch {
        continue;
      }
    }

    return skillPacks.sort((left, right) => left.packRef.localeCompare(right.packRef));
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

function isMissingFileError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "ENOENT";
}

function isAlreadyExistsError(error: unknown): boolean {
  return typeof error === "object"
    && error !== null
    && "code" in error
    && error.code === "EEXIST";
}

async function cleanupTemporarySkillPackFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}
