"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const promises_1 = require("node:fs/promises");
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = __importDefault(require("node:test"));
async function readSource(relativePath) {
    return (0, promises_1.readFile)(node_path_1.default.join(process.cwd(), relativePath), "utf8");
}
(0, node_test_1.default)("les consommateurs importent les guards et helpers factorises au lieu de les reimplementer", async () => {
    const [auditProjectionSource, readMissionAuditSource, approvalQueueSource, artifactIndexSource, resolveApprovalSource, readMissionResumeSource, ticketSupportSource, runTicketSource, createTicketSource, updateTicketSource, moveTicketSource, cancelTicketSource, selectMissionExtensionsSource,] = await Promise.all([
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
    strict_1.default.match(auditProjectionSource, /persisted-document-guards/);
    strict_1.default.doesNotMatch(auditProjectionSource, /function isApprovalRequest\(/);
    strict_1.default.doesNotMatch(auditProjectionSource, /function isArtifact\(/);
    strict_1.default.doesNotMatch(auditProjectionSource, /function isTicket\(/);
    strict_1.default.doesNotMatch(auditProjectionSource, /function isExecutionAttempt\(/);
    strict_1.default.doesNotMatch(auditProjectionSource, /function isWorkspaceIsolationMetadata\(/);
    strict_1.default.doesNotMatch(auditProjectionSource, /function isCapabilityInvocationDetails\(/);
    strict_1.default.doesNotMatch(auditProjectionSource, /function normalizeOpaqueReferences\(/);
    // Le fork delibere `isAuditMissionShape` est autorise et documente dans
    // audit-log-projection ; un `function isMission(` local serait un naming trap.
    strict_1.default.doesNotMatch(auditProjectionSource, /function isMission\(/);
    strict_1.default.match(readMissionAuditSource, /persisted-document-guards/);
    strict_1.default.doesNotMatch(readMissionAuditSource, /function isApprovalRequest\(/);
    strict_1.default.doesNotMatch(readMissionAuditSource, /function isArtifact\(/);
    strict_1.default.doesNotMatch(readMissionAuditSource, /function isTicket\(/);
    strict_1.default.doesNotMatch(readMissionAuditSource, /function isExecutionAttempt\(/);
    strict_1.default.doesNotMatch(readMissionAuditSource, /function isWorkspaceIsolationMetadata\(/);
    strict_1.default.doesNotMatch(readMissionAuditSource, /function isCapabilityInvocationDetails\(/);
    strict_1.default.match(approvalQueueSource, /persisted-document-guards/);
    strict_1.default.doesNotMatch(approvalQueueSource, /function isApprovalRequest\(/);
    strict_1.default.match(artifactIndexSource, /persisted-document-guards/);
    strict_1.default.doesNotMatch(artifactIndexSource, /function isArtifact\(/);
    strict_1.default.match(resolveApprovalSource, /persisted-document-guards/);
    strict_1.default.doesNotMatch(resolveApprovalSource, /function isApprovalRequest\(/);
    strict_1.default.match(readMissionResumeSource, /mission-service\/ensure-mission-workspace/);
    strict_1.default.doesNotMatch(readMissionResumeSource, /async function ensureMissionWorkspaceInitialized\(/);
    strict_1.default.match(ticketSupportSource, /contracts\/src\/extension\/extension-registration/);
    strict_1.default.doesNotMatch(ticketSupportSource, /function normalizeOpaqueReferences\(/);
    // Le 4e clone historique de `ensureMissionWorkspaceInitialized` a ete supprime :
    // les commandes ticket doivent importer le helper canonique (Story 5.3 NFR17).
    strict_1.default.doesNotMatch(ticketSupportSource, /function ensureMissionWorkspaceInitialized\(/);
    for (const [sourceName, source] of [
        ["run-ticket", runTicketSource],
        ["create-ticket", createTicketSource],
        ["update-ticket", updateTicketSource],
        ["move-ticket", moveTicketSource],
        ["cancel-ticket", cancelTicketSource],
        ["select-mission-extensions", selectMissionExtensionsSource],
    ]) {
        strict_1.default.match(source, /import\s*\{\s*ensureMissionWorkspaceInitialized\s*\}\s*from\s*"(?:\.\.\/)*(?:(?:\.\.\/)*mission-kernel\/src\/)?mission-service\/ensure-mission-workspace"|import\s*\{\s*ensureMissionWorkspaceInitialized\s*\}\s*from\s*"\.\/ensure-mission-workspace"/, `${sourceName} doit importer le helper workspace canonique`);
        strict_1.default.doesNotMatch(source, /function ensureMissionWorkspaceInitialized\(/, `${sourceName} ne doit pas reimplementer localement ensureMissionWorkspaceInitialized`);
    }
});
