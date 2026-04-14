import path from "node:path";

import type { RegisteredSkillPackLocalRefs } from "../../../contracts/src/extension/registered-skill-pack";

export interface AssertSkillPackLocalBoundaryOptions {
  packRef: string;
  localRefs: RegisteredSkillPackLocalRefs;
}

export function assertSkillPackLocalBoundary(
  options: AssertSkillPackLocalBoundaryOptions,
): void {
  const rootDir = path.resolve(options.localRefs.rootDir);

  for (const [index, referencePath] of options.localRefs.references.entries()) {
    assertPathWithinSkillPackRoot(rootDir, path.resolve(referencePath), options.packRef, `references[${index}]`);
  }

  if (options.localRefs.metadataFile) {
    assertPathWithinSkillPackRoot(
      rootDir,
      path.resolve(options.localRefs.metadataFile),
      options.packRef,
      "metadataFile",
    );
  }

  for (const [index, scriptPath] of options.localRefs.scripts.entries()) {
    assertPathWithinSkillPackRoot(rootDir, path.resolve(scriptPath), options.packRef, `scripts[${index}]`);
  }
}

function assertPathWithinSkillPackRoot(
  rootDir: string,
  candidatePath: string,
  packRef: string,
  label: string,
): void {
  const relativePath = path.relative(rootDir, candidatePath);
  const staysWithinRoot = relativePath === ""
    || (!relativePath.startsWith("..") && !path.isAbsolute(relativePath));

  if (staysWithinRoot) {
    return;
  }

  throw new Error(
    `Le skill pack \`${packRef}\` sort de sa frontiere locale pour \`${label}\`: ${candidatePath}.`,
  );
}
