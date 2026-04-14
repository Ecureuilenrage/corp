import type { Dirent } from "node:fs";
import { mkdir, readdir, readFile, rename, unlink, writeFile } from "node:fs/promises";

import type { RegisteredCapability } from "../../../contracts/src/extension/registered-capability";
import { resolveCapabilityStoragePaths, type WorkspaceLayout } from "../fs-layout/workspace-layout";
import { deepStrictEqualForComparison } from "../../../ticket-runtime/src/utils/structural-compare";

export interface SaveRegisteredCapabilityResult {
  status: "registered" | "unchanged";
  capabilityDir: string;
  capabilityPath: string;
  registeredCapability: RegisteredCapability;
}

export interface CapabilityRegistryReader {
  findByCapabilityId(capabilityId: string): Promise<RegisteredCapability | null>;
}

export interface CapabilityRegistryRepository extends CapabilityRegistryReader {
  save(registeredCapability: RegisteredCapability): Promise<SaveRegisteredCapabilityResult>;
  list(): Promise<RegisteredCapability[]>;
}

export class FileCapabilityRegistryRepository implements CapabilityRegistryRepository {
  public constructor(private readonly layout: WorkspaceLayout) {}

  public async save(
    registeredCapability: RegisteredCapability,
  ): Promise<SaveRegisteredCapabilityResult> {
    const capabilityStoragePaths = resolveCapabilityStoragePaths(
      this.layout,
      registeredCapability.capabilityId,
    );
    const existingCapability = await this.findByCapabilityId(
      registeredCapability.capabilityId,
    );

    if (existingCapability) {
      if (
        deepStrictEqualForComparison(
          toComparableRegisteredCapability(existingCapability),
          toComparableRegisteredCapability(registeredCapability),
        )
      ) {
        return {
          status: "unchanged",
          capabilityDir: capabilityStoragePaths.capabilityDir,
          capabilityPath: capabilityStoragePaths.capabilityPath,
          registeredCapability: existingCapability,
        };
      }

      throw new Error(
        `Collision ambigue pour la capability \`${registeredCapability.capabilityId}\`: une autre registration existe deja.`,
      );
    }

    await mkdir(this.layout.capabilitiesDir, { recursive: true });

    try {
      await mkdir(capabilityStoragePaths.capabilityDir);
    } catch (error) {
      if (isAlreadyExistsError(error)) {
        throw new Error(
          `Enregistrement concurrent detecte pour la capability \`${registeredCapability.capabilityId}\`.`,
        );
      }

      throw error;
    }

    const temporaryCapabilityPath = `${capabilityStoragePaths.capabilityPath}.tmp`;

    try {
      // Best-effort V1: claim the directory, then write a temp file and rename it to avoid
      // partially written registry entries without introducing a full lock manager.
      await writeFile(
        temporaryCapabilityPath,
        `${JSON.stringify(registeredCapability, null, 2)}\n`,
        "utf8",
      );
      await rename(temporaryCapabilityPath, capabilityStoragePaths.capabilityPath);
    } catch (error) {
      try {
        await cleanupTemporaryCapabilityFile(temporaryCapabilityPath);
      } catch {
        // Best-effort cleanup: the original write/rename error is more important.
      }

      throw error;
    }

    return {
      status: "registered",
      capabilityDir: capabilityStoragePaths.capabilityDir,
      capabilityPath: capabilityStoragePaths.capabilityPath,
      registeredCapability,
    };
  }

  public async findByCapabilityId(
    capabilityId: string,
  ): Promise<RegisteredCapability | null> {
    const capabilityStoragePaths = resolveCapabilityStoragePaths(
      this.layout,
      capabilityId,
    );

    try {
      const storedCapability = await readFile(capabilityStoragePaths.capabilityPath, "utf8");
      return JSON.parse(storedCapability) as RegisteredCapability;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
      }

      if (error instanceof SyntaxError) {
        throw new Error(
          `Fichier de registre corrompu pour la capability \`${capabilityId}\`.`,
        );
      }

      throw error;
    }
  }

  public async list(): Promise<RegisteredCapability[]> {
    const capabilityEntries = await readDirectoryEntries(this.layout.capabilitiesDir);
    const capabilities: RegisteredCapability[] = [];

    for (const capabilityEntry of capabilityEntries) {
      if (!capabilityEntry.isDirectory()) {
        continue;
      }

      const capability = await this.findByCapabilityId(capabilityEntry.name);

      if (capability) {
        capabilities.push(capability);
      }
    }

    return capabilities.sort((left, right) =>
      left.capabilityId.localeCompare(right.capabilityId)
    );
  }
}

export function createFileCapabilityRegistryRepository(
  layout: WorkspaceLayout,
): FileCapabilityRegistryRepository {
  return new FileCapabilityRegistryRepository(layout);
}

function toComparableRegisteredCapability(
  registeredCapability: RegisteredCapability,
): Omit<RegisteredCapability, "registeredAt"> {
  const { registeredAt: _registeredAt, ...comparableCapability } = registeredCapability;
  return comparableCapability;
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

async function cleanupTemporaryCapabilityFile(filePath: string): Promise<void> {
  try {
    await unlink(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }

    throw error;
  }
}
