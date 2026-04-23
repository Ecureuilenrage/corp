import type { Dirent } from "node:fs";
import { mkdir, readdir } from "node:fs/promises";

import { validateRegisteredCapability } from "../../../contracts/src/guards/persisted-document-guards";
import { normalizeOpaqueReferenceKey } from "../../../contracts/src/extension/extension-registration";
import type { RegisteredCapability } from "../../../contracts/src/extension/registered-capability";
import { deepStrictEqualForComparison } from "../../../ticket-runtime/src/utils/structural-compare";
import { isAlreadyExistsError, writeJsonAtomic } from "../fs-layout/atomic-json";
import { isMissingFileError } from "../fs-layout/file-system-read-errors";
import { resolveCapabilityStoragePaths, type WorkspaceLayout } from "../fs-layout/workspace-layout";
import {
  assertValidPersistedDocument,
  readPersistedJsonDocument,
} from "./persisted-document-errors";

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
      if (hasCaseCollision(
        existingCapability.capabilityId,
        registeredCapability.capabilityId,
      )) {
        throw new Error(
          `Collision de casse detectee pour la capability \`${registeredCapability.capabilityId}\`: deja enregistree comme \`${existingCapability.capabilityId}\`.`,
        );
      }

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

    await writeJsonAtomic(capabilityStoragePaths.capabilityPath, registeredCapability);

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
    const context = {
      filePath: capabilityStoragePaths.capabilityPath,
      entityLabel: "RegisteredCapability",
      corruptionLabel: "fichier de registre corrompu pour la capability",
      documentId: capabilityId,
    };

    try {
      const storedCapability = await readPersistedJsonDocument(context);
      assertValidPersistedDocument<RegisteredCapability>(
        storedCapability,
        validateRegisteredCapability,
        context,
      );
      return storedCapability;
    } catch (error) {
      if (isMissingFileError(error)) {
        return null;
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

function hasCaseCollision(existingValue: string, requestedValue: string): boolean {
  return existingValue !== requestedValue
    && normalizeOpaqueReferenceKey(existingValue)
      === normalizeOpaqueReferenceKey(requestedValue);
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
