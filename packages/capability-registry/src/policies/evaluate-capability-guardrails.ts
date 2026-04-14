import type { Mission } from "../../../contracts/src/mission/mission";
import type { RegisteredCapability } from "../../../contracts/src/extension/registered-capability";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import { buildApprovalGuardrailsSnapshot } from "../../../ticket-runtime/src/ticket-service/ticket-service-support";

export interface EvaluateCapabilityGuardrailsOptions {
  capability: RegisteredCapability;
  mission: Mission;
  ticket: Ticket;
}

export interface EvaluateCapabilityGuardrailsResult {
  guardrails: string[];
}

export function evaluateCapabilityGuardrails(
  options: EvaluateCapabilityGuardrailsOptions,
): EvaluateCapabilityGuardrailsResult {
  if (!options.ticket.allowedCapabilities.includes(options.capability.capabilityId)) {
    throw new Error(
      `La capability \`${options.capability.capabilityId}\` n'est pas autorisee pour le ticket \`${options.ticket.id}\`.`,
    );
  }

  return {
    guardrails: buildApprovalGuardrailsSnapshot({
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

function collectMissingEnvGuardrails(requiredEnvNames: string[]): string[] {
  const missingGuardrails: string[] = [];
  const seenEnvNames = new Set<string>();

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
