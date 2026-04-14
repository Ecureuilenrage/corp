import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import test from "node:test";

const execFileAsync = promisify(execFile);

function buildSprintStatus(entries: Array<[string, string]>): string {
  const lines = [
    'generated: "2026-04-14T00:00:00+02:00"',
    'last_updated: "2026-04-14T00:00:00+02:00"',
    'project: "corp"',
    'project_key: "NOKEY"',
    'tracking_system: "file-system"',
    'story_location: "C:/tmp/_bmad-output/implementation"',
    "",
    "development_status:",
  ];

  for (const [key, value] of entries) {
    lines.push(`  ${key}: ${value}`);
  }

  return `${lines.join("\n")}\n`;
}

function buildStoryFile(storyKey: string, status: string): string {
  return [
    `# Story ${storyKey}`,
    "",
    `Status: ${status}`,
    "",
    "## Story",
    "",
    "Fixture de test.",
    "",
  ].join("\n");
}

type StoryFixture = string | { contents: string };

async function writeImplementationFixture(
  rootDir: string,
  options: {
    entries?: Array<[string, string]>;
    sprintStatusContents?: string;
    stories?: Record<string, StoryFixture>;
  },
): Promise<void> {
  const implementationDir = path.join(rootDir, "_bmad-output", "implementation");
  await mkdir(implementationDir, { recursive: true });
  await writeFile(
    path.join(implementationDir, "sprint-status.yaml"),
    options.sprintStatusContents ?? buildSprintStatus(options.entries ?? []),
    "utf8",
  );

  for (const [storyKey, storyFixture] of Object.entries(options.stories ?? {})) {
    const contents =
      typeof storyFixture === "string"
        ? buildStoryFile(storyKey, storyFixture)
        : storyFixture.contents;
    await writeFile(path.join(implementationDir, `${storyKey}.md`), contents, "utf8");
  }
}

async function runCheck(
  rootDir: string,
  args: string[] = ["--root", rootDir],
): Promise<{
  exitCode: number;
  output: string;
}> {
  const scriptPath = path.join(process.cwd(), "dist", "scripts", "check-epic-closure.js");

  try {
    const result = await execFileAsync(process.execPath, [scriptPath, ...args], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        LC_ALL: "de_DE",
        LANG: "de_DE",
      },
    });

    return {
      exitCode: 0,
      output: `${result.stdout}${result.stderr}`.trim(),
    };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim(),
    };
  }
}

async function runGitCommand(
  rootDir: string,
  args: string[],
): Promise<{
  exitCode: number;
  output: string;
}> {
  try {
    const result = await execFileAsync("git", args, {
      cwd: rootDir,
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "Corp Tests",
        GIT_AUTHOR_EMAIL: "corp-tests@example.test",
        GIT_COMMITTER_NAME: "Corp Tests",
        GIT_COMMITTER_EMAIL: "corp-tests@example.test",
      },
    });

    return {
      exitCode: 0,
      output: `${result.stdout}${result.stderr}`.trim(),
    };
  } catch (error) {
    const failure = error as NodeJS.ErrnoException & {
      code?: number | string;
      stdout?: string;
      stderr?: string;
    };

    return {
      exitCode: typeof failure.code === "number" ? failure.code : 1,
      output: `${failure.stdout ?? ""}${failure.stderr ?? ""}`.trim(),
    };
  }
}

function countOccurrences(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

test("check-epic-closure retourne 0 quand un epic done est completement synchronise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-ok-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "done"],
      ["9-1-preparer-la-cloture", "done"],
      ["9-2-synchroniser-les-artefacts", "done"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {
      "9-1-preparer-la-cloture": "done",
      "9-2-synchroniser-les-artefacts": "done",
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /Verification cloture epic: ok/);
  assert.match(result.output, /epic-9/);
});

test("check-epic-closure inspecte un epic done avec commentaire inline YAML", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-inline-comment-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    sprintStatusContents: [
      'generated: "2026-04-14T00:00:00+02:00"',
      'last_updated: "2026-04-14T00:00:00+02:00"',
      'project: "corp"',
      'project_key: "NOKEY"',
      'tracking_system: "file-system"',
      'story_location: "C:/tmp/_bmad-output/implementation"',
      "",
      "development_status:",
      "  epic-9: done # note review",
      "  9-1-preparer-la-cloture: done",
      "  epic-9-retrospective: done",
      "",
    ].join("\n"),
    stories: {
      "9-1-preparer-la-cloture": "review",
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 1);
  assert.match(result.output, /epic-9/);
  assert.match(result.output, /9-1-preparer-la-cloture/);
  assert.match(result.output, /Status: review/);
});

for (const quotedValue of ['"done"', "'done'"]) {
  test(`check-epic-closure reconnait la valeur quotee ${quotedValue}`, async (t) => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-quoted-"));

    t.after(async () => {
      await rm(rootDir, { recursive: true, force: true });
    });

    await writeImplementationFixture(rootDir, {
      entries: [
        ["epic-9", quotedValue],
        ["9-1-preparer-la-cloture", "done"],
        ["epic-9-retrospective", "done"],
      ],
      stories: {
        "9-1-preparer-la-cloture": "review",
      },
    });

    const result = await runCheck(rootDir);

    assert.equal(result.exitCode, 1);
    assert.match(result.output, /epic-9/);
    assert.match(result.output, /Status: review/);
  });
}

test("check-epic-closure dedoublonne les cles development_status et conserve la derniere valeur", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-duplicate-key-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    sprintStatusContents: [
      'generated: "2026-04-14T00:00:00+02:00"',
      'last_updated: "2026-04-14T00:00:00+02:00"',
      'project: "corp"',
      'project_key: "NOKEY"',
      'tracking_system: "file-system"',
      'story_location: "C:/tmp/_bmad-output/implementation"',
      "",
      "development_status:",
      "  epic-9: backlog",
      "  epic-9: done",
      "  9-1-preparer-la-cloture: done",
      "  epic-9-retrospective: done",
      "",
    ].join("\n"),
    stories: {
      "9-1-preparer-la-cloture": "done",
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /cle dupliquee/i);
  assert.match(result.output, /Epics verifies: epic-9/);
  assert.doesNotMatch(result.output, /Epics verifies: .*epic-9, epic-9/);
});

for (const invalidLine of ["\tepic-9: done", "   epic-9: done"]) {
  test(`check-epic-closure rejette une indentation invalide (${JSON.stringify(invalidLine)})`, async (t) => {
    const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-invalid-indent-"));

    t.after(async () => {
      await rm(rootDir, { recursive: true, force: true });
    });

    await writeImplementationFixture(rootDir, {
      sprintStatusContents: [
        'generated: "2026-04-14T00:00:00+02:00"',
        'last_updated: "2026-04-14T00:00:00+02:00"',
        'project: "corp"',
        'project_key: "NOKEY"',
        'tracking_system: "file-system"',
        'story_location: "C:/tmp/_bmad-output/implementation"',
        "",
        "development_status:",
        invalidLine,
        "  9-1-preparer-la-cloture: done",
        "  epic-9-retrospective: done",
        "",
      ].join("\n"),
      stories: {
        "9-1-preparer-la-cloture": "done",
      },
    });

    const result = await runCheck(rootDir);

    assert.equal(result.exitCode, 1);
    assert.match(result.output, /indentation invalide dans development_status, attendu 2 espaces/i);
  });
}

test("check-epic-closure signale un epic in-progress pret a clore mais desynchronise par un story file", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-pre-transition-story-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "in-progress"],
      ["9-1-preparer-la-cloture", "done"],
      ["9-2-synchroniser-les-artefacts", "done"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {
      "9-1-preparer-la-cloture": "review",
      "9-2-synchroniser-les-artefacts": "done",
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 1);
  assert.match(result.output, /epic pret a clore mais desynchronise/i);
  assert.match(result.output, /9-1-preparer-la-cloture/);
  assert.match(result.output, /Status: review/);
});

test("check-epic-closure signale un epic in-progress pret a clore mais sans retrospective done", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-pre-transition-retro-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "in-progress"],
      ["9-1-preparer-la-cloture", "done"],
      ["9-2-synchroniser-les-artefacts", "done"],
      ["epic-9-retrospective", "required"],
    ],
    stories: {
      "9-1-preparer-la-cloture": "done",
      "9-2-synchroniser-les-artefacts": "done",
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 1);
  assert.match(result.output, /epic pret a clore mais desynchronise/i);
  assert.match(result.output, /epic-9-retrospective/);
  assert.match(result.output, /required/);
});

test("check-epic-closure retourne 0 quand un epic in-progress pret a clore est deja synchronise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-pre-transition-ok-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "in-progress"],
      ["9-1-preparer-la-cloture", "done"],
      ["9-2-synchroniser-les-artefacts", "done"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {
      "9-1-preparer-la-cloture": "done",
      "9-2-synchroniser-les-artefacts": "done",
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /epic-9/);
});

test("check-epic-closure echoue explicitement si un story file reference est introuvable", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-missing-story-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "done"],
      ["9-1-preparer-la-cloture", "done"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {},
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 1);
  assert.match(result.output, /9-1-preparer-la-cloture\.md/);
  assert.match(result.output, /ENOENT|introuvable/i);
});

test("check-epic-closure accepte la forme --root=<path>", async (t) => {
  const tempParent = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-root-eq-parent-"));
  const rootDir = path.join(tempParent, "--workspace-racine");
  await mkdir(rootDir, { recursive: true });

  t.after(async () => {
    await rm(tempParent, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "done"],
      ["9-1-preparer-la-cloture", "done"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {
      "9-1-preparer-la-cloture": "done",
    },
  });

  const result = await runCheck(rootDir, [`--root=${rootDir}`]);

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /Verification cloture epic: ok/);
});

test("check-epic-closure n'emet qu'une seule erreur quand le tracker n'est pas done et le story file est absent", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-single-error-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "done"],
      ["9-1-preparer-la-cloture", "review"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {},
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 1);
  assert.equal(countOccurrences(result.output, "9-1-preparer-la-cloture"), 1);
  assert.match(result.output, /attendu: done/i);
});

test("check-epic-closure lit Status uniquement dans le header et conserve la derniere ligne Status", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-header-status-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "done"],
      ["9-1-preparer-la-cloture", "done"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {
      "9-1-preparer-la-cloture": {
        contents: [
          "# Story 9-1-preparer-la-cloture",
          "",
          "```yaml",
          "Status: review",
          "```",
          "",
          "Status: done",
          "",
          "## Story",
          "",
          "Fixture de test.",
          "",
        ].join("\n"),
      },
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /Verification cloture epic: ok/);
});

test("check-epic-closure alerte quand un epic done n'a aucune story associee", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-no-story-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "done"],
      ["epic-9-retrospective", "done"],
    ],
    stories: {},
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 0);
  assert.match(result.output, /aucune story associee/i);
});

test("check-epic-closure rejette une entree development_status avec caracteres inattendus", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-invalid-key-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    sprintStatusContents: [
      'generated: "2026-04-14T00:00:00+02:00"',
      'last_updated: "2026-04-14T00:00:00+02:00"',
      'project: "corp"',
      'project_key: "NOKEY"',
      'tracking_system: "file-system"',
      'story_location: "C:/tmp/_bmad-output/implementation"',
      "",
      "development_status:",
      "  epic#9: done",
      "  9-1-preparer-la-cloture: done",
      "  epic-9-retrospective: done",
      "",
    ].join("\n"),
    stories: {
      "9-1-preparer-la-cloture": "done",
    },
  });

  const result = await runCheck(rootDir);

  assert.equal(result.exitCode, 1);
  assert.match(result.output, /entree development_status invalide/i);
});

test("le hook pre-commit opt-in bloque un commit si un epic pret a clore reste desynchronise", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-epic-closure-hook-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  await writeImplementationFixture(rootDir, {
    entries: [
      ["epic-9", "in-progress"],
      ["9-1-preparer-la-cloture", "done"],
      ["epic-9-retrospective", "required"],
    ],
    stories: {
      "9-1-preparer-la-cloture": "done",
    },
  });

  await mkdir(path.join(rootDir, ".githooks"), { recursive: true });
  await mkdir(path.join(rootDir, "dist", "scripts"), { recursive: true });
  await copyFile(
    path.join(process.cwd(), ".githooks", "pre-commit"),
    path.join(rootDir, ".githooks", "pre-commit"),
  );
  await copyFile(
    path.join(process.cwd(), "dist", "scripts", "check-epic-closure.js"),
    path.join(rootDir, "dist", "scripts", "check-epic-closure.js"),
  );
  await chmod(path.join(rootDir, ".githooks", "pre-commit"), 0o755);
  await writeFile(path.join(rootDir, "tracked.txt"), "fixture\n", "utf8");

  await runGitCommand(rootDir, ["init"]);
  await runGitCommand(rootDir, ["config", "core.hooksPath", ".githooks"]);
  await runGitCommand(rootDir, ["config", "user.name", "Corp Tests"]);
  await runGitCommand(rootDir, ["config", "user.email", "corp-tests@example.test"]);
  await runGitCommand(rootDir, ["add", "."]);

  const commitResult = await runGitCommand(rootDir, ["commit", "-m", "test hook"]);

  assert.equal(commitResult.exitCode, 1);
  assert.match(commitResult.output, /check-epic-closure|epic pret a clore mais desynchronise/i);
});
