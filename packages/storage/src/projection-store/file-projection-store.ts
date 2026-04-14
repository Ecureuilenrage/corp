import { access, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type ProjectionSnapshot = object;
export type ProjectionCatalog = Record<string, ProjectionSnapshot>;

export interface ProjectionSeedResult {
  createdPaths: string[];
}

export async function seedProjectionStore(
  projectionsDir: string,
  projections: ProjectionCatalog,
): Promise<ProjectionSeedResult> {
  const createdPaths: string[] = [];

  for (const [projectionName, snapshot] of Object.entries(projections)) {
    const projectionPath = path.join(projectionsDir, `${projectionName}.json`);
    const created = await writeFileIfMissing(
      projectionPath,
      `${JSON.stringify(snapshot, null, 2)}\n`,
    );

    if (created) {
      createdPaths.push(projectionPath);
    }
  }

  return { createdPaths };
}

export function resolveProjectionPath(projectionsDir: string, projectionName: string): string {
  return path.join(projectionsDir, `${projectionName}.json`);
}

export async function readProjectionFile(
  projectionsDir: string,
  projectionName: string,
): Promise<string> {
  const projectionPath = resolveProjectionPath(projectionsDir, projectionName);
  return readFile(projectionPath, "utf8");
}

export async function readProjectionSnapshot<T>(
  projectionsDir: string,
  projectionName: string,
): Promise<T> {
  return JSON.parse(await readProjectionFile(projectionsDir, projectionName)) as T;
}

export async function writeProjectionSnapshot(
  projectionsDir: string,
  projectionName: string,
  snapshot: ProjectionSnapshot,
): Promise<string> {
  const projectionPath = resolveProjectionPath(projectionsDir, projectionName);

  await writeFile(projectionPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  return projectionPath;
}

async function writeFileIfMissing(filePath: string, contents: string): Promise<boolean> {
  try {
    await access(filePath);
    return false;
  } catch {
    await writeFile(filePath, contents, "utf8");
    return true;
  }
}
