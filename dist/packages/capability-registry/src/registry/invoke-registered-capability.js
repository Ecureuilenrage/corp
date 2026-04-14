"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invokeRegisteredCapability = invokeRegisteredCapability;
const evaluate_capability_guardrails_1 = require("../policies/evaluate-capability-guardrails");
const read_registered_capability_1 = require("./read-registered-capability");
async function invokeRegisteredCapability(options) {
    const registeredCapability = await resolveRegisteredCapability(options);
    const evaluation = (0, evaluate_capability_guardrails_1.evaluateCapabilityGuardrails)({
        capability: registeredCapability,
        mission: options.mission,
        ticket: options.ticket,
    });
    return {
        kind: "invoked",
        guardrails: evaluation.guardrails,
        event: {
            eventId: options.eventId,
            type: "capability.invoked",
            missionId: options.mission.id,
            ticketId: options.ticket.id,
            ...(options.attemptId ? { attemptId: options.attemptId } : {}),
            occurredAt: options.occurredAt,
            actor: options.actor,
            source: options.source,
            payload: {
                capability: toCapabilityInvocationDetails(registeredCapability),
                guardrails: evaluation.guardrails,
                trigger: options.trigger,
            },
        },
    };
}
async function resolveRegisteredCapability(options) {
    if ("capability" in options) {
        return options.capability;
    }
    return await (0, read_registered_capability_1.readRegisteredCapability)({
        repository: options.repository,
        capabilityId: options.capabilityId,
    });
}
function toCapabilityInvocationDetails(capability) {
    return {
        capabilityId: capability.capabilityId,
        registrationId: capability.registrationId,
        provider: capability.provider,
        approvalSensitive: capability.approvalSensitive,
        permissions: [...capability.permissions],
        constraints: [...capability.constraints],
        requiredEnvNames: [...capability.requiredEnvNames],
    };
}
