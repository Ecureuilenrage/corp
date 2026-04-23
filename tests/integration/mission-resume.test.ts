import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { runCli } from "../../apps/corp-cli/src/index";
import { setRunTicketDependenciesForTesting } from "../../packages/ticket-runtime/src/ticket-service/run-ticket";

interface CommandResult {
  exitCode: number;
  lines: string[];
}

async function runCommand(args: string[]): Promise<CommandResult> {
  const lines: string[] = [];
  const exitCode = await runCli(args, {
    writeLine: (line: string) => lines.push(line),
  });

  return {
    exitCode,
    lines,
  };
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function createMission(rootDir: string): Promise<{ missionId: string; lastEventId: string }> {
  const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(bootstrapResult.exitCode, 0);

  const createResult = await runCommand([
    "mission",
    "create",
    "--root",
    rootDir,
    "--title",
    "Mission reprise",
    "--objective",
    "Retrouver l'etat courant sans relire le transcript",
    "--success-criterion",
    "L'operateur voit l'objectif courant",
    "--success-criterion",
    "Les sections vides restent explicites",
    "--policy-profile",
    "policy_profile_local",
  ]);

  assert.equal(createResult.exitCode, 0);

  const missionCreatedLine = createResult.lines.find((line) =>
    line.startsWith("Mission creee: "),
  );

  assert.ok(missionCreatedLine, "la creation doit retourner un missionId");

  const missionId = missionCreatedLine.slice("Mission creee: ".length);
  const journalEntries = (await readFile(
    path.join(rootDir, ".corp", "journal", "events.jsonl"),
    "utf8",
  ))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);

  return {
    missionId,
    lastEventId: String(journalEntries.at(-1)?.eventId),
  };
}

test("mission status et mission resume restituent un resume operateur scannable", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId, lastEventId } = await createMission(rootDir);

  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  for (const result of [statusResult, resumeResult]) {
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, new RegExp(`Mission: ${missionId}`));
    assert.match(output, /Titre: Mission reprise/);
    assert.match(output, /Objectif: Retrouver l'etat courant sans relire le transcript/);
    assert.match(output, /Statut: ready/);
    assert.match(output, /Criteres de succes:/);
    assert.match(output, /1\. L'operateur voit l'objectif courant/);
    assert.match(output, /2\. Les sections vides restent explicites/);
    assert.match(output, /Tickets ouverts: aucun/);
    assert.match(output, /Validations en attente: aucune/);
    assert.match(output, /Dernier artefact pertinent: aucun/);
    assert.match(output, /Dernier blocage connu: aucun/);
    assert.match(output, new RegExp(`Dernier evenement: ${lastEventId}`));
    assert.match(output, /Prochain arbitrage utile: Aucun ticket n'existe encore\./);
    assert.doesNotMatch(output, /codex|openai|response_id|thread_id/i);
  }
});

test("mission resume expose le diagnostic journal_invalide quand le journal est illisible", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-invalid-journal-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  await writeFile(
    path.join(rootDir, ".corp", "journal", "events.jsonl"),
    "{json invalide\n",
    "utf8",
  );

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.match(
    result.lines.at(-1) ?? "",
    /journal_invalide: journal append-only invalide a la ligne 1 .*JSON corrompu\./,
  );
  assert.doesNotMatch(result.lines.at(-1) ?? "", /SyntaxError|Journal mission irreconciliable/);
});

test("mission resume preserve la cause originale quand mission.json est corrompu et que le journal est vide", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-corrupted-empty-journal-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const bootstrapResult = await runCommand(["mission", "bootstrap", "--root", rootDir]);
  assert.equal(bootstrapResult.exitCode, 0);

  const missionId = "mission_corrupted_resume";
  const missionPath = path.join(rootDir, ".corp", "missions", missionId, "mission.json");

  await writeFile(path.join(rootDir, ".corp", "journal", "events.jsonl"), "", "utf8");
  await mkdir(path.dirname(missionPath), { recursive: true });
  await writeFile(missionPath, "{json invalide\n", "utf8");

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 1);
  assert.match(result.lines.at(-1) ?? "", /json_corrompu: Mission `mission_corrupted_resume` invalide/i);
  assert.doesNotMatch(result.lines.at(-1) ?? "", /Mission introuvable|Journal mission irreconciliable/);
});

test("mission status et mission resume restent strictement read-only pour le journal", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-read-only-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);
  const journalPath = path.join(rootDir, ".corp", "journal", "events.jsonl");
  const beforeRead = await readFile(journalPath, "utf8");

  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const afterRead = await readFile(journalPath, "utf8");

  assert.equal(statusResult.exitCode, 0);
  assert.equal(resumeResult.exitCode, 0);
  assert.equal(afterRead, beforeRead);
});

test("mission resume reconstruit resume-view quand la projection est absente", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-missing-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId, lastEventId } = await createMission(rootDir);
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  await unlink(resumeViewPath);

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), /Prochain arbitrage utile: Aucun ticket n'existe encore\./);

  const reconstructedProjection = await readJson<Record<string, unknown>>(resumeViewPath);

  assert.deepEqual(reconstructedProjection, {
    schemaVersion: 1,
    resume: {
      missionId,
      title: "Mission reprise",
      objective: "Retrouver l'etat courant sans relire le transcript",
      status: "ready",
      successCriteria: [
        "L'operateur voit l'objectif courant",
        "Les sections vides restent explicites",
      ],
      authorizedExtensions: {
        allowedCapabilities: [],
        skillPackRefs: [],
      },
      openTickets: [],
      pendingApprovals: [],
      lastRelevantArtifact: null,
      lastKnownBlockage: null,
      lastEventId,
      updatedAt: String((reconstructedProjection.resume as Record<string, unknown>).updatedAt),
      nextOperatorAction:
        "Aucun ticket n'existe encore. La prochaine etape probable releve de la suite Epic 1 / Epic 2.",
    },
  });
});

test("mission status reconstruit resume-view stale avant affichage", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-stale-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId, lastEventId } = await createMission(rootDir);
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  await writeFile(
    resumeViewPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        resume: {
          missionId,
          title: "Mission reprise",
          objective: "Obsolete",
          status: "ready",
          successCriteria: [],
          openTickets: [],
          pendingApprovals: [],
          lastRelevantArtifact: null,
          lastEventId: "event_obsolete",
          updatedAt: "2026-01-01T00:00:00.000Z",
          nextOperatorAction: "Obsolete",
        },
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
  assert.doesNotMatch(result.lines.join("\n"), /event_obsolete/);

  const reconstructedProjection = await readJson<Record<string, unknown>>(resumeViewPath);
  const reconstructedResume = reconstructedProjection.resume as Record<string, unknown>;

  assert.equal(reconstructedResume.lastEventId, lastEventId);
  assert.equal(
    reconstructedResume.nextOperatorAction,
    "Aucun ticket n'existe encore. La prochaine etape probable releve de la suite Epic 1 / Epic 2.",
  );
  assert.ok(
    "lastKnownBlockage" in reconstructedResume,
    "le snapshot reconstruit doit contenir lastKnownBlockage meme si l'ancien n'en avait pas",
  );
  assert.equal(
    reconstructedResume.lastKnownBlockage,
    null,
    "lastKnownBlockage doit etre null quand la mission ready n'a aucun blocage",
  );
});

test("mission resume reconstruit resume-view quand le schemaVersion est inattendu", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-schema-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId, lastEventId } = await createMission(rootDir);
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  await writeFile(
    resumeViewPath,
    JSON.stringify({ schemaVersion: 99, resume: null }, null, 2),
    "utf8",
  );

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));

  const reconstructed = await readJson<Record<string, unknown>>(resumeViewPath);

  assert.equal((reconstructed as { schemaVersion: number }).schemaVersion, 1);
});

test("mission resume reconstruit resume-view quand le missionId ne correspond pas", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-wrong-id-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId, lastEventId } = await createMission(rootDir);
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  const originalProjection = await readJson<Record<string, unknown>>(resumeViewPath);
  const originalResume = originalProjection.resume as Record<string, unknown>;

  await writeFile(
    resumeViewPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        resume: { ...originalResume, missionId: "mission_autre" },
      },
      null,
      2,
    ),
    "utf8",
  );

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), new RegExp(`Mission: ${missionId}`));
  assert.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
});

test("mission resume reconstruit resume-view quand resume est null dans un fichier valide", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-null-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId, lastEventId } = await createMission(rootDir);
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  await writeFile(
    resumeViewPath,
    JSON.stringify({ schemaVersion: 1, resume: null }, null, 2),
    "utf8",
  );

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), new RegExp(`Mission: ${missionId}`));
  assert.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));

  const reconstructed = await readJson<Record<string, unknown>>(resumeViewPath);
  const reconstructedResume = (reconstructed as { resume: Record<string, unknown> }).resume;

  assert.equal(reconstructedResume.missionId, missionId);
  assert.equal(reconstructedResume.lastEventId, lastEventId);
});

test("mission resume reconstruit un resume lifecycle depuis le journal si resume-view est corrompu", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-lifecycle-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);
  const pauseResult = await runCommand([
    "mission",
    "pause",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(pauseResult.exitCode, 0);

  const journalEntries = (await readFile(
    path.join(rootDir, ".corp", "journal", "events.jsonl"),
    "utf8",
  ))
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as Record<string, unknown>);
  const lastEventId = String(journalEntries.at(-1)?.eventId);
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  await writeFile(resumeViewPath, "{corrupted", "utf8");

  const result = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  assert.equal(result.exitCode, 0);
  assert.match(result.lines.join("\n"), /Statut: blocked/);
  assert.match(result.lines.join("\n"), /Dernier blocage connu: Mission mise en pause/);
  assert.match(result.lines.join("\n"), new RegExp(`Dernier evenement: ${lastEventId}`));
  assert.match(
    result.lines.join("\n"),
    /Prochain arbitrage utile: Mission bloquee\. Relancez-la quand les conditions de reprise sont reunies\./,
  );

  const reconstructedProjection = await readJson<Record<string, unknown>>(resumeViewPath);

  assert.deepEqual(reconstructedProjection, {
    schemaVersion: 1,
    resume: {
      missionId,
      title: "Mission reprise",
      objective: "Retrouver l'etat courant sans relire le transcript",
      status: "blocked",
      successCriteria: [
        "L'operateur voit l'objectif courant",
        "Les sections vides restent explicites",
      ],
      authorizedExtensions: {
        allowedCapabilities: [],
        skillPackRefs: [],
      },
      openTickets: [],
      pendingApprovals: [],
      lastRelevantArtifact: null,
      lastKnownBlockage: {
        kind: "mission_lifecycle",
        summary: "Mission mise en pause",
        missionStatus: "blocked",
        occurredAt: String((reconstructedProjection.resume as Record<string, unknown>).updatedAt),
        reasonCode: "mission_paused",
        sourceEventId: lastEventId,
      },
      lastEventId,
      updatedAt: String((reconstructedProjection.resume as Record<string, unknown>).updatedAt),
      nextOperatorAction:
        "Mission bloquee. Relancez-la quand les conditions de reprise sont reunies.",
    },
  });
});

test("mission status et mission resume exposent immediatement le ticket ouvert cree", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-ticket-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Livrer une delegation traquable",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket apparait au resume",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketCreatedLine = ticketCreateResult.lines.find((line) =>
    line.startsWith("Ticket cree: "),
  );

  assert.ok(ticketCreatedLine, "la creation doit retourner un ticketId");
  const ticketId = ticketCreatedLine.slice("Ticket cree: ".length);

  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  for (const result of [statusResult, resumeResult]) {
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, new RegExp(`Mission: ${missionId}`));
    assert.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
    assert.doesNotMatch(output, /Tickets ouverts: aucun/);
    assert.doesNotMatch(output, /Aucun ticket n'existe encore/);
    assert.match(
      output,
      /Prochain arbitrage utile: Traitez le prochain ticket runnable: Livrer une delegation traquable\./,
    );
  }
});

test("mission status devient la vue detaillee tandis que mission resume reste compacte", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-status-detailed-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Afficher un board detaille",
    "--owner",
    "agent_status",
    "--success-criterion",
    "Le ticket apparait dans la supervision detaillee",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const statusResult = await runCommand([
    "mission",
    "status",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);

  const statusOutput = statusResult.lines.join("\n");
  const resumeOutput = resumeResult.lines.join("\n");

  assert.equal(statusResult.exitCode, 0);
  assert.equal(resumeResult.exitCode, 0);
  assert.match(statusOutput, /Etat des tickets:/);
  assert.match(statusOutput, new RegExp(`${ticketId} \\| statut=todo \\| owner=agent_status`));
  assert.match(statusOutput, /motif=pret a lancer/);
  assert.doesNotMatch(statusOutput, /codex|openai|response_id|thread_id/i);
  assert.doesNotMatch(resumeOutput, /Etat des tickets:/);
  assert.doesNotMatch(resumeOutput, new RegExp(`${ticketId} \\| statut=todo`));
  assert.match(resumeOutput, new RegExp(`Tickets ouverts: ${ticketId}`));
});

test("readMissionStatus ne lit le ticket-board qu'une seule fois", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-status-single-board-read-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Verifier la lecture unique du board",
    "--owner",
    "agent_status",
    "--success-criterion",
    "Le board est lu une seule fois",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const readTicketBoardModule = require("../../packages/ticket-runtime/src/planner/read-ticket-board") as {
    readTicketBoard: (options: {
      rootDir: string;
      missionId: string;
      commandName: "status" | "resume" | "ticket board";
    }) => Promise<{
      mission: { id: string };
      board: { tickets: Array<{ ticketId: string }> };
      reconstructed: boolean;
      projectionPath: string;
    }>;
  };
  const readMissionStatusModule = require("../../packages/mission-kernel/src/resume-service/read-mission-status") as {
    readMissionStatus: (options: {
      rootDir: string;
      missionId: string;
    }) => Promise<{
      resume: { missionId: string; openTickets: Array<{ ticketId?: string }> };
      ticketBoard: { tickets: Array<{ ticketId: string }> };
      reconstructed: boolean;
    }>;
  };
  const originalReadTicketBoard = readTicketBoardModule.readTicketBoard;
  let readTicketBoardCallCount = 0;

  readTicketBoardModule.readTicketBoard = async (
    ...args: Parameters<typeof originalReadTicketBoard>
  ) => {
    readTicketBoardCallCount += 1;
    return originalReadTicketBoard(...args);
  };

  t.after(() => {
    readTicketBoardModule.readTicketBoard = originalReadTicketBoard;
  });

  const statusResult = await readMissionStatusModule.readMissionStatus({
    rootDir,
    missionId,
  });

  assert.equal(readTicketBoardCallCount, 1);
  assert.equal(statusResult.resume.missionId, missionId);
  assert.equal(statusResult.ticketBoard.tickets.length, 1);
  assert.equal(statusResult.resume.openTickets.length, 1);
  assert.equal(
    statusResult.ticketBoard.tickets[0]?.ticketId,
    statusResult.resume.openTickets[0]?.ticketId,
  );
});

test("mission resume privilegie le premier ticket runnable plutot que le premier ticket ouvert", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-runnable-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const prerequisiteResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Verifier le prerequis runnable",
    "--owner",
    "agent_pre",
    "--success-criterion",
    "Le prerequis est visible",
  ]);
  const dependentResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Ticket dependant non runnable",
    "--owner",
    "agent_dep",
    "--depends-on",
    String(
      prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
    ),
    "--success-criterion",
    "Le dependent est visible",
  ]);

  assert.equal(prerequisiteResult.exitCode, 0);
  assert.equal(dependentResult.exitCode, 0);

  const prerequisiteTicketId = String(
    prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const dependentTicketId = String(
    dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const moveResult = await runCommand([
    "mission",
    "ticket",
    "move",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    dependentTicketId,
    "--to-front",
  ]);

  assert.equal(moveResult.exitCode, 0);

  for (const commandName of ["status", "resume"] as const) {
    const result = await runCommand([
      "mission",
      commandName,
      "--root",
      rootDir,
      "--mission-id",
      missionId,
    ]);
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, new RegExp(`Tickets ouverts: ${dependentTicketId}, ${prerequisiteTicketId}`));
    assert.match(
      output,
      /Prochain arbitrage utile: Traitez le prochain ticket runnable: Verifier le prerequis runnable\./,
    );
  }
});

test("mission resume oriente vers la replanification quand aucun ticket ouvert n'est runnable", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-replan-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const prerequisiteResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Prerequis a annuler",
    "--owner",
    "agent_pre",
    "--success-criterion",
    "Le prerequis existe",
  ]);

  assert.equal(prerequisiteResult.exitCode, 0);

  const prerequisiteTicketId = String(
    prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const dependentResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Dependent bloque",
    "--owner",
    "agent_dep",
    "--depends-on",
    prerequisiteTicketId,
    "--success-criterion",
    "Le dependent existe",
  ]);

  assert.equal(dependentResult.exitCode, 0);

  const dependentTicketId = String(
    dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const cancelResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    prerequisiteTicketId,
  ]);

  assert.equal(cancelResult.exitCode, 0);

  for (const commandName of ["status", "resume"] as const) {
    const result = await runCommand([
      "mission",
      commandName,
      "--root",
      rootDir,
      "--mission-id",
      missionId,
    ]);
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, new RegExp(`Tickets ouverts: ${dependentTicketId}`));
    assert.doesNotMatch(output, new RegExp(`Tickets ouverts: .*${prerequisiteTicketId}`));
    assert.match(
      output,
      /Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment\. Replanifiez ou debloquez la mission avant de poursuivre\./,
    );
  }
});

test("mission resume expose un blocage ticket_blocked quand un ticket est bloque par dependance", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-ticket-blocked-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);

  const prerequisiteResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Prerequis a annuler pour bloquer",
    "--owner",
    "agent_pre",
    "--success-criterion",
    "Le prerequis existe",
  ]);

  assert.equal(prerequisiteResult.exitCode, 0);

  const prerequisiteTicketId = String(
    prerequisiteResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const dependentResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Dependent bloque par annulation",
    "--owner",
    "agent_dep",
    "--depends-on",
    prerequisiteTicketId,
    "--success-criterion",
    "Le dependent est bloque",
  ]);

  assert.equal(dependentResult.exitCode, 0);

  const dependentTicketId = String(
    dependentResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const cancelResult = await runCommand([
    "mission",
    "ticket",
    "cancel",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    prerequisiteTicketId,
  ]);

  assert.equal(cancelResult.exitCode, 0);

  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const output = resumeResult.lines.join("\n");

  assert.equal(resumeResult.exitCode, 0);
  assert.match(
    output,
    new RegExp(`Dernier blocage connu: Ticket ${dependentTicketId} bloque \\| ticket=${dependentTicketId}`),
  );
  assert.match(output, /raison=dependance annulee/);
  assert.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_action/i);

  const resumeView = await readJson<{
    resume: {
      lastKnownBlockage: Record<string, unknown> | null;
    } | null;
  }>(path.join(rootDir, ".corp", "projections", "resume-view.json"));
  const blockage = resumeView.resume?.lastKnownBlockage as Record<string, unknown> | null;

  assert.ok(blockage);
  assert.equal(blockage.kind, "ticket_blocked");
  assert.equal(blockage.ticketId, dependentTicketId);
  assert.equal(blockage.reasonCode, "dependency_cancelled");
  assert.equal(blockage.sourceEventId, null);
});

test("mission resume oriente vers le suivi d'un ticket en cours apres mission ticket run", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-running-ticket-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "requested",
        adapterState: {
          responseId: "resp_resume_running",
          pollCursor: "cursor_resume_running",
          vendorStatus: "queued",
        },
      }),
    }),
  });

  const { missionId } = await createMission(rootDir);

  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Suivre un ticket deja parti",
    "--owner",
    "agent_dev",
    "--success-criterion",
    "Le ticket peut etre lance",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);

  for (const commandName of ["status", "resume"] as const) {
    const result = await runCommand([
      "mission",
      commandName,
      "--root",
      rootDir,
      "--mission-id",
      missionId,
    ]);
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, /Statut: running/);
    assert.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
    assert.match(output, /Dernier blocage connu: aucun/);
    assert.match(
      output,
      /Prochain arbitrage utile: Suivez le ticket en cours: Suivre un ticket deja parti\./,
    );
    assert.doesNotMatch(output, /Aucun ticket n'est runnable pour le moment/);
    assert.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_approval/i);
  }

  const resumeView = await readJson<{
    resume: {
      lastKnownBlockage: null;
      nextOperatorAction: string;
    } | null;
  }>(path.join(rootDir, ".corp", "projections", "resume-view.json"));

  assert.equal(resumeView.resume?.lastKnownBlockage, null);
  assert.equal(
    resumeView.resume?.nextOperatorAction,
    "Suivez le ticket en cours: Suivre un ticket deja parti.",
  );
});

test("mission resume privilegie une validation en attente sur le suivi d'un ticket en cours", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-pending-approval-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_resume_approval",
          pollCursor: "cursor_resume_approval",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation critique",
          actionType: "workspace_write",
          actionSummary: "Ecriture sensible dans le workspace",
          guardrails: ["manual_review: workspace_write"],
        },
      }),
    }),
  });

  const { missionId } = await createMission(rootDir);

  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Attendre une validation explicite",
    "--owner",
    "agent_approval",
    "--success-criterion",
    "Le ticket peut etre arbitre",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);

  for (const commandName of ["status", "resume"] as const) {
    const result = await runCommand([
      "mission",
      commandName,
      "--root",
      rootDir,
      "--mission-id",
      missionId,
    ]);
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, /Statut: awaiting_approval/);
    assert.match(output, /Validations en attente: approval_/);
    assert.match(
      output,
      new RegExp(`Dernier blocage connu: Validation en attente pour le ticket ${ticketId}: Ecriture sensible dans le workspace \\| validation=approval_`),
    );
    assert.match(
      output,
      /Prochain arbitrage utile: Arbitrez la prochaine validation en attente: Validation critique\./,
    );
    assert.doesNotMatch(output, /Suivez le ticket en cours/);
    assert.doesNotMatch(output, /responseId|pollCursor|vendorStatus|requires_approval/i);
  }

  const resumeView = await readJson<{
    resume: {
      lastKnownBlockage: Record<string, unknown> | null;
    } | null;
  }>(path.join(rootDir, ".corp", "projections", "resume-view.json"));
  const blockage = resumeView.resume?.lastKnownBlockage as Record<string, unknown> | null;

  assert.ok(blockage);
  assert.equal(blockage.kind, "approval_pending");
  assert.equal(blockage.ticketId, ticketId);
  assert.equal(blockage.reasonCode, "approval_requested");
  assert.match(String(blockage.approvalId), /^approval_/);
  assert.match(String(blockage.attemptId), /^attempt_/);
  assert.match(String(blockage.sourceEventId), /^event_/);
  assert.doesNotMatch(JSON.stringify(blockage), /responseId|pollCursor|vendorStatus|requires_approval/i);
});

test("mission resume reecrit un resume enrichi quand resume-view est ancien et approval-queue stale", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-stale-upstream-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async () => ({
        status: "awaiting_approval",
        adapterState: {
          responseId: "resp_resume_stale",
          pollCursor: "cursor_resume_stale",
          vendorStatus: "requires_approval",
        },
        approvalRequest: {
          title: "Validation stale",
          actionType: "workspace_write",
          actionSummary: "Ecriture sensible apres reconstruction",
          guardrails: ["manual_review: workspace_write"],
        },
      }),
    }),
  });

  const { missionId } = await createMission(rootDir);
  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Retrouver le resume enrichi",
    "--owner",
    "agent_stale",
    "--success-criterion",
    "Le resume est reecrit",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
    "--background",
  ]);

  assert.equal(runResult.exitCode, 0);

  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const approvalQueuePath = path.join(rootDir, ".corp", "projections", "approval-queue.json");
  const staleResumeView = await readJson<{ resume: Record<string, unknown> | null }>(resumeViewPath);

  await writeFile(
    resumeViewPath,
    JSON.stringify(
      {
        schemaVersion: 1,
        resume: {
          ...staleResumeView.resume,
          pendingApprovals: [],
          nextOperatorAction: "Obsolete",
        },
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(approvalQueuePath, "{corrupted", "utf8");

  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const reconstructedResumeView = await readJson<{
    resume: {
      lastKnownBlockage: Record<string, unknown> | null;
      pendingApprovals: Array<{ approvalId?: string }>;
      nextOperatorAction: string;
    } | null;
  }>(resumeViewPath);

  assert.equal(resumeResult.exitCode, 0);
  assert.match(
    resumeResult.lines.join("\n"),
    new RegExp(`Dernier blocage connu: Validation en attente pour le ticket ${ticketId}: Ecriture sensible apres reconstruction \\| validation=approval_`),
  );
  assert.equal(
    reconstructedResumeView.resume?.lastKnownBlockage?.kind,
    "approval_pending",
  );
  assert.match(
    String(reconstructedResumeView.resume?.pendingApprovals[0]?.approvalId),
    /^approval_/,
  );
  assert.equal(
    reconstructedResumeView.resume?.nextOperatorAction,
    "Arbitrez la prochaine validation en attente: Validation stale.",
  );
});

test("mission resume exclut les tickets failed des tickets ouverts et oriente vers la replanification", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-failed-ticket-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);
  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Ticket echoue a replanifier",
    "--owner",
    "agent_failed",
    "--success-criterion",
    "Le ticket existe",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    missionId,
    "tickets",
    ticketId,
    "ticket.json",
  );
  const ticket = await readJson<Record<string, unknown>>(ticketPath);

  await writeFile(
    ticketPath,
    JSON.stringify(
      {
        ...ticket,
        status: "failed",
        updatedAt: "2026-04-10T10:10:10.000Z",
      },
      null,
      2,
    ),
    "utf8",
  );
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");

  await unlink(resumeViewPath);

  for (const commandName of ["status", "resume"] as const) {
    const result = await runCommand([
      "mission",
      commandName,
      "--root",
      rootDir,
      "--mission-id",
      missionId,
    ]);
    const output = result.lines.join("\n");

    assert.equal(result.exitCode, 0);
    assert.match(output, /Tickets ouverts: aucun/);
    assert.doesNotMatch(output, new RegExp(`Tickets ouverts: .*${ticketId}`));
    assert.match(
      output,
      /Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment\. Replanifiez ou debloquez la mission avant de poursuivre\./,
    );
    assert.doesNotMatch(output, /Aucun ticket n'existe encore/);
  }

  const resumeView = await readJson<{ resume: Record<string, unknown> | null }>(
    resumeViewPath,
  );
  const openTickets = (resumeView.resume?.openTickets ?? []) as Array<Record<string, unknown>>;

  assert.deepEqual(openTickets, []);
  assert.equal(
    resumeView.resume?.nextOperatorAction,
    "Aucun ticket n'est runnable pour le moment. Replanifiez ou debloquez la mission avant de poursuivre.",
  );
});

test("mission resume expose un blocage ticket_failed tout en preservant le dernier artefact utile", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-failed-artifact-"));

  t.after(async () => {
    setRunTicketDependenciesForTesting(null);
    await rm(rootDir, { recursive: true, force: true });
  });

  setRunTicketDependenciesForTesting({
    createAdapter: () => ({
      id: "codex_responses",
      launch: async ({ workspacePath }) => {
        await writeFile(path.join(workspacePath, "README.md"), "resume failure\n", "utf8");
        throw new Error("adapter boom");
      },
    }),
  });

  const { missionId } = await createMission(rootDir);
  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Produire un artefact avant echec",
    "--owner",
    "agent_failed_artifact",
    "--success-criterion",
    "Le dernier artefact reste visible",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );

  const runResult = await runCommand([
    "mission",
    "ticket",
    "run",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--ticket-id",
    ticketId,
  ]);

  assert.equal(runResult.exitCode, 1);
  assert.equal(runResult.lines.at(-1), "adapter boom");

  const resumeResult = await runCommand([
    "mission",
    "resume",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
  ]);
  const resumeView = await readJson<{
    resume: {
      lastKnownBlockage: Record<string, unknown> | null;
      lastRelevantArtifact: Record<string, unknown> | null;
    } | null;
  }>(path.join(rootDir, ".corp", "projections", "resume-view.json"));
  const blockage = resumeView.resume?.lastKnownBlockage as Record<string, unknown> | null;
  const artifact = resumeView.resume?.lastRelevantArtifact as Record<string, unknown> | null;

  assert.equal(resumeResult.exitCode, 0);
  assert.match(
    resumeResult.lines.join("\n"),
    new RegExp(`Dernier blocage connu: Ticket ${ticketId} en echec \\| ticket=${ticketId} \\| tentative=attempt_.* \\| raison=ticket en echec`),
  );
  assert.match(resumeResult.lines.join("\n"), /Dernier artefact pertinent: .*README\.md/);
  assert.ok(blockage);
  assert.equal(blockage.kind, "ticket_failed");
  assert.equal(blockage.ticketId, ticketId);
  assert.equal(blockage.reasonCode, "ticket_failed");
  assert.match(String(blockage.attemptId), /^attempt_/);
  assert.match(String(blockage.sourceEventId), /^event_/);
  assert.ok(artifact);
  assert.equal(artifact.path, "README.md");
});

test("mission resume garde un ticket lisible quand un snapshot porte un statut fantome", async (t) => {
  const rootDir = await mkdtemp(path.join(tmpdir(), "corp-mission-resume-ghost-statuses-"));

  t.after(async () => {
    await rm(rootDir, { recursive: true, force: true });
  });

  const { missionId } = await createMission(rootDir);
  const ticketCreateResult = await runCommand([
    "mission",
    "ticket",
    "create",
    "--root",
    rootDir,
    "--mission-id",
    missionId,
    "--kind",
    "implement",
    "--goal",
    "Ticket au statut fantome",
    "--owner",
    "agent_ghost",
    "--success-criterion",
    "Le ticket existe",
  ]);

  assert.equal(ticketCreateResult.exitCode, 0);

  const ticketId = String(
    ticketCreateResult.lines.find((line) => line.startsWith("Ticket cree: "))?.slice("Ticket cree: ".length),
  );
  const ticketPath = path.join(
    rootDir,
    ".corp",
    "missions",
    missionId,
    "tickets",
    ticketId,
    "ticket.json",
  );
  const resumeViewPath = path.join(rootDir, ".corp", "projections", "resume-view.json");
  const ticket = await readJson<Record<string, unknown>>(ticketPath);

  for (const ghostStatus of ["completed", "closed"]) {
    await writeFile(
      ticketPath,
      JSON.stringify(
        {
          ...ticket,
          status: ghostStatus,
          updatedAt: `2026-04-10T10:10:${ghostStatus === "completed" ? "10" : "20"}.000Z`,
        },
        null,
        2,
      ),
      "utf8",
    );
    await unlink(resumeViewPath);

    for (const commandName of ["status", "resume"] as const) {
      const result = await runCommand([
        "mission",
        commandName,
        "--root",
        rootDir,
        "--mission-id",
        missionId,
      ]);
      const output = result.lines.join("\n");

      assert.equal(result.exitCode, 0);
      assert.match(output, new RegExp(`Tickets ouverts: ${ticketId}`));
      assert.doesNotMatch(output, /Tickets ouverts: aucun/);
      assert.match(
        output,
        /Prochain arbitrage utile: Aucun ticket n'est runnable pour le moment\. Replanifiez ou debloquez la mission avant de poursuivre\./,
      );

      if (commandName === "status") {
        assert.match(output, new RegExp(`statut=${ghostStatus}`));
        assert.match(output, /motif=ticket bloque/);
      }
    }

    const resumeView = await readJson<{ resume: { openTickets: Array<Record<string, unknown>> } | null }>(
      resumeViewPath,
    );

    assert.equal(resumeView.resume?.openTickets[0]?.ticketId, ticketId);
    assert.equal(resumeView.resume?.openTickets[0]?.status, ghostStatus);
  }
});
