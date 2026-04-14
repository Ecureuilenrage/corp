import type { RegisteredCapability } from "../../../contracts/src/extension/registered-capability";
import type { CapabilityRegistryReader } from "../../../storage/src/repositories/file-capability-registry-repository";

export interface ReadRegisteredCapabilityOptions {
  repository: CapabilityRegistryReader;
  capabilityId: string;
}

export async function readRegisteredCapability(
  options: ReadRegisteredCapabilityOptions,
): Promise<RegisteredCapability> {
  const registeredCapability = await options.repository.findByCapabilityId(
    options.capabilityId,
  );

  if (!registeredCapability) {
    throw new Error(
      `Capability introuvable dans le registre local: ${options.capabilityId}.`,
    );
  }

  return registeredCapability;
}
