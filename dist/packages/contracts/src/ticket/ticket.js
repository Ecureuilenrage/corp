"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TICKET_KINDS = exports.NON_UPDATABLE_TICKET_STATUSES = exports.TERMINAL_TICKET_STATUSES = void 0;
/**
 * Statuts terminaux d'un ticket. Une fois atteint, aucun flux de mutation
 * metier ne doit continuer a modifier le ticket.
 */
exports.TERMINAL_TICKET_STATUSES = [
    "done",
    "failed",
    "cancelled",
];
/**
 * Statuts qui interdisent les mises a jour de contenu via `ticket update`.
 * Les transitions de statut restent reservees aux commandes dediees.
 */
exports.NON_UPDATABLE_TICKET_STATUSES = [
    "done",
    "failed",
    "cancelled",
    "claimed",
    "in_progress",
    "blocked",
];
exports.TICKET_KINDS = [
    "research",
    "plan",
    "implement",
    "review",
    "operate",
];
