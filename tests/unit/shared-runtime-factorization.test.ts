import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

async function readSource(relativePath: string): Promise<string> {
  return readFile(path.join(process.cwd(), relativePath), "utf8");
}

test("les consommateurs importent les guards et helpers factorises au lieu de les reimplementer", async () => {
  const [
    auditProjectionSource,
    readMissionAuditSource,
    approvalQueueSource,
    artifactIndexSource,
    resolveApprovalSource,
    readMissionResumeSource,
    ticketSupportSource,
    runTicketSource,
    createTicketSource,
    updateTicketSource,
    moveTicketSource,
    cancelTicketSource,
    selectMissionExtensionsSource,
  ] = await Promise.all([
    readSource("packages/journal/src/projections/audit-log-projection.ts"),
    readSource("packages/mission-kernel/src/resume-service/read-mission-audit.ts"),
    readSource("packages/journal/src/projections/approval-queue-projection.ts"),
    readSource("packages/journal/src/projections/artifact-index-projection.ts"),
    readSource("packages/mission-kernel/src/approval-service/resolve-approval-request.ts"),
    readSource("packages/mission-kernel/src/resume-service/read-mission-resume.ts"),
    readSource("packages/ticket-runtime/src/ticket-service/ticket-service-support.ts"),
    readSource("packages/ticket-runtime/src/ticket-service/run-ticket.ts"),
    readSource("packages/ticket-runtime/src/ticket-service/create-ticket.ts"),
    readSource("packages/ticket-runtime/src/ticket-service/update-ticket.ts"),
    readSource("packages/ticket-runtime/src/ticket-service/move-ticket.ts"),
    readSource("packages/ticket-runtime/src/ticket-service/cancel-ticket.ts"),
    readSource("packages/mission-kernel/src/mission-service/select-mission-extensions.ts"),
  ]);

  assert.match(auditProjectionSource, /persisted-document-guards/);
  assert.doesNotMatch(auditProjectionSource, /function isApprovalRequest\(/);
  assert.doesNotMatch(auditProjectionSource, /function isArtifact\(/);
  assert.doesNotMatch(auditProjectionSource, /function isTicket\(/);
  assert.doesNotMatch(auditProjectionSource, /function isExecutionAttempt\(/);
  assert.doesNotMatch(auditProjectionSource, /function isWorkspaceIsolationMetadata\(/);
  assert.doesNotMatch(auditProjectionSource, /function isCapabilityInvocationDetails\(/);
  assert.doesNotMatch(auditProjectionSource, /function normalizeOpaqueReferences\(/);
  // Le fork delibere `isAuditMissionShape` est autorise et documente dans
  // audit-log-projection ; un `function isMission(` local serait un naming trap.
  assert.doesNotMatch(auditProjectionSource, /function isMission\(/);

  assert.match(readMissionAuditSource, /persisted-document-guards/);
  assert.doesNotMatch(readMissionAuditSource, /function isApprovalRequest\(/);
  assert.doesNotMatch(readMissionAuditSource, /function isArtifact\(/);
  assert.doesNotMatch(readMissionAuditSource, /function isTicket\(/);
  assert.doesNotMatch(readMissionAuditSource, /function isExecutionAttempt\(/);
  assert.doesNotMatch(readMissionAuditSource, /function isWorkspaceIsolationMetadata\(/);
  assert.doesNotMatch(readMissionAuditSource, /function isCapabilityInvocationDetails\(/);

  assert.match(approvalQueueSource, /persisted-document-guards/);
  assert.doesNotMatch(approvalQueueSource, /function isApprovalRequest\(/);

  assert.match(artifactIndexSource, /persisted-document-guards/);
  assert.doesNotMatch(artifactIndexSource, /function isArtifact\(/);

  assert.match(resolveApprovalSource, /persisted-document-guards/);
  assert.doesNotMatch(resolveApprovalSource, /function isApprovalRequest\(/);

  assert.match(readMissionResumeSource, /mission-service\/ensure-mission-workspace/);
  assert.doesNotMatch(readMissionResumeSource, /async function ensureMissionWorkspaceInitialized\(/);

  assert.match(ticketSupportSource, /contracts\/src\/extension\/extension-registration/);
  assert.doesNotMatch(ticketSupportSource, /function normalizeOpaqueReferences\(/);
  // Le 4e clone historique de `ensureMissionWorkspaceInitialized` a ete supprime :
  // les commandes ticket doivent importer le helper canonique (Story 5.3 NFR17).
  assert.doesNotMatch(ticketSupportSource, /function ensureMissionWorkspaceInitialized\(/);

  for (const [sourceName, source] of [
    ["run-ticket", runTicketSource],
    ["create-ticket", createTicketSource],
    ["update-ticket", updateTicketSource],
    ["move-ticket", moveTicketSource],
    ["cancel-ticket", cancelTicketSource],
    ["select-mission-extensions", selectMissionExtensionsSource],
  ] as const) {
    assert.match(
      source,
      /import\s*\{\s*ensureMissionWorkspaceInitialized\s*\}\s*from\s*"(?:\.\.\/)*(?:(?:\.\.\/)*mission-kernel\/src\/)?mission-service\/ensure-mission-workspace"|import\s*\{\s*ensureMissionWorkspaceInitialized\s*\}\s*from\s*"\.\/ensure-mission-workspace"/,
      `${sourceName} doit importer le helper workspace canonique`,
    );
    assert.doesNotMatch(
      source,
      /function ensureMissionWorkspaceInitialized\(/,
      `${sourceName} ne doit pas reimplementer localement ensureMissionWorkspaceInitialized`,
    );
  }
});
