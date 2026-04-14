import type { Ticket } from "../../../contracts/src/ticket/ticket";
import type { FileTicketRepository } from "../../../storage/src/repositories/file-ticket-repository";
import { normalizeOpaqueReferences } from "../ticket-service/ticket-service-support";

export interface ValidateTicketDependenciesOptions {
  missionId: string;
  ticketRepository: FileTicketRepository;
  missionTickets: Ticket[];
  dependsOn: string[];
  targetTicketId?: string;
}

export async function validateAndNormalizeTicketDependencies(
  options: ValidateTicketDependenciesOptions,
): Promise<string[]> {
  const normalizedDependencies = normalizeOpaqueReferences(options.dependsOn);
  const missionTicketsById = new Map(
    options.missionTickets.map((ticket) => [ticket.id, ticket] as const),
  );

  for (const dependencyId of normalizedDependencies) {
    if (options.targetTicketId && dependencyId === options.targetTicketId) {
      throw new Error(`Le ticket \`${options.targetTicketId}\` ne peut pas dependre de lui-meme.`);
    }

    const dependencyTicket = missionTicketsById.get(dependencyId);

    if (dependencyTicket) {
      if (dependencyTicket.status === "cancelled") {
        // A cancelled prerequisite can never become `done`, so accepting it here would
        // permanently deadlock the dependent ticket. We still accept `failed` tickets
        // because they may be retried later and eventually unblock the graph.
        throw new Error(
          `La dependance \`${dependencyId}\` est deja \`cancelled\` dans la mission \`${options.missionId}\`.`,
        );
      }

      continue;
    }

    const dependencyMissionId = await options.ticketRepository.findOwningMissionId(dependencyId);

    if (dependencyMissionId && dependencyMissionId !== options.missionId) {
      throw new Error(
        `La dependance \`${dependencyId}\` n'appartient pas a la mission \`${options.missionId}\`.`,
      );
    }

    throw new Error(
      `La dependance \`${dependencyId}\` est introuvable dans la mission \`${options.missionId}\`.`,
    );
  }

  if (
    options.targetTicketId
    && introducesDependencyCycle(
      missionTicketsById,
      options.targetTicketId,
      normalizedDependencies,
    )
  ) {
    throw new Error(
      `La mise a jour du ticket \`${options.targetTicketId}\` introduit un cycle de dependances.`,
    );
  }

  return normalizedDependencies;
}

function introducesDependencyCycle(
  missionTicketsById: Map<string, Ticket>,
  targetTicketId: string,
  targetDependencies: string[],
): boolean {
  const visited = new Set<string>();
  const inStack = new Set<string>();

  function visit(ticketId: string): boolean {
    if (inStack.has(ticketId)) {
      return true;
    }

    if (visited.has(ticketId)) {
      return false;
    }

    visited.add(ticketId);
    inStack.add(ticketId);

    const dependencies = ticketId === targetTicketId
      ? targetDependencies
      : missionTicketsById.get(ticketId)?.dependsOn ?? [];

    for (const dependencyId of dependencies) {
      if (!missionTicketsById.has(dependencyId) && dependencyId !== targetTicketId) {
        continue;
      }

      if (visit(dependencyId)) {
        return true;
      }
    }

    inStack.delete(ticketId);
    return false;
  }

  return visit(targetTicketId);
}
