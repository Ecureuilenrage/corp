import type { RegisteredSkillPack } from "../../../contracts/src/extension/registered-skill-pack";
import type { SkillPackRegistryReader } from "../../../storage/src/repositories/file-skill-pack-registry-repository";

export interface ReadRegisteredSkillPackOptions {
  repository: SkillPackRegistryReader;
  packRef: string;
}

export async function readRegisteredSkillPack(
  options: ReadRegisteredSkillPackOptions,
): Promise<RegisteredSkillPack> {
  const registeredSkillPack = await options.repository.findByPackRef(options.packRef);

  if (!registeredSkillPack) {
    throw new Error(
      `Skill pack introuvable dans le registre local: ${options.packRef}.`,
    );
  }

  return registeredSkillPack;
}
