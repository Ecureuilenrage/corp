import type { JournalEventRecord } from "../../../journal/src/event-log/append-event";
import type {
  CapabilityInvocationDetails,
  RegisteredCapability,
} from "../../../contracts/src/extension/registered-capability";
import type { Mission } from "../../../contracts/src/mission/mission";
import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { CapabilityRegistryReader } from "../../../storage/src/repositories/file-capability-registry-repository";
import { evaluateCapabilityGuardrails } from "../policies/evaluate-capability-guardrails";
import { readRegisteredCapability } from "./read-registered-capability";

interface InvokeRegisteredCapabilityBaseOptions {
  mission: Mission;
  ticket: Ticket;
  attemptId?: string;
  eventId: string;
  occurredAt: string;
  actor: JournalEventRecord["actor"];
  source: string;
  trigger: string;
}

interface InvokeRegisteredCapabilityResolvedOptions
  extends InvokeRegisteredCapabilityBaseOptions {
  capability: RegisteredCapability;
}

interface InvokeRegisteredCapabilityLookupOptions
  extends InvokeRegisteredCapabilityBaseOptions {
  repository: CapabilityRegistryReader;
  capabilityId: string;
}

export type InvokeRegisteredCapabilityOptions =
  | InvokeRegisteredCapabilityResolvedOptions
  | InvokeRegisteredCapabilityLookupOptions;

export interface InvokeRegisteredCapabilityResult {
  kind: "invoked";
  guardrails: string[];
  event: JournalEventRecord;
}

export async function invokeRegisteredCapability(
  options: InvokeRegisteredCapabilityOptions,
): Promise<InvokeRegisteredCapabilityResult> {
  const registeredCapability = await resolveRegisteredCapability(options);
  const evaluation = evaluateCapabilityGuardrails({
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

async function resolveRegisteredCapability(
  options: InvokeRegisteredCapabilityOptions,
): Promise<RegisteredCapability> {
  if ("capability" in options) {
    return options.capability;
  }

  return await readRegisteredCapability({
    repository: options.repository,
    capabilityId: options.capabilityId,
  });
}

function toCapabilityInvocationDetails(
  capability: RegisteredCapability,
): CapabilityInvocationDetails {
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
