"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateCapabilityGuardrails = evaluateCapabilityGuardrails;
const ticket_service_support_1 = require("../../../ticket-runtime/src/ticket-service/ticket-service-support");
function evaluateCapabilityGuardrails(options) {
    if (!options.ticket.allowedCapabilities.includes(options.capability.capabilityId)) {
        throw new Error(`La capability \`${options.capability.capabilityId}\` n'est pas autorisee pour le ticket \`${options.ticket.id}\`.`);
    }
    return {
        guardrails: (0, ticket_service_support_1.buildApprovalGuardrailsSnapshot)({
            baseGuardrails: [
                ...(options.capability.approvalSensitive
                    ? [`approval_sensitive: ${options.capability.capabilityId}`]
                    : []),
                ...collectMissingEnvGuardrails(options.capability.requiredEnvNames),
            ],
            policyProfileId: options.mission.policyProfileId,
            allowedCapabilities: options.ticket.allowedCapabilities,
            skillPackRefs: options.ticket.skillPackRefs,
        }),
    };
}
function collectMissingEnvGuardrails(requiredEnvNames) {
    const missingGuardrails = [];
    const seenEnvNames = new Set();
    for (const envName of requiredEnvNames) {
        const normalizedEnvName = envName.trim();
        if (!normalizedEnvName || seenEnvNames.has(normalizedEnvName)) {
            continue;
        }
        seenEnvNames.add(normalizedEnvName);
        // V1 remains non-blocking: the guardrail warns the core, but invocation can continue.
        if (!process.env[normalizedEnvName]?.trim()) {
            missingGuardrails.push(`missing_env: ${normalizedEnvName}`);
        }
    }
    return missingGuardrails;
}
