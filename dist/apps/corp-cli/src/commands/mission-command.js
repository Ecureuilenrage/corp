"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.runMissionCommand = runMissionCommand;
const node_path_1 = __importDefault(require("node:path"));
const bootstrap_mission_workspace_1 = require("../../../../packages/mission-kernel/src/bootstrap/bootstrap-mission-workspace");
const create_mission_1 = require("../../../../packages/mission-kernel/src/mission-service/create-mission");
const select_mission_extensions_1 = require("../../../../packages/mission-kernel/src/mission-service/select-mission-extensions");
const read_mission_artifacts_1 = require("../../../../packages/mission-kernel/src/resume-service/read-mission-artifacts");
const read_mission_audit_1 = require("../../../../packages/mission-kernel/src/resume-service/read-mission-audit");
const read_approval_queue_1 = require("../../../../packages/mission-kernel/src/resume-service/read-approval-queue");
const relaunch_impacted_branch_1 = require("../../../../packages/mission-kernel/src/mission-service/relaunch-impacted-branch");
const read_mission_compare_1 = require("../../../../packages/mission-kernel/src/resume-service/read-mission-compare");
const update_mission_lifecycle_1 = require("../../../../packages/mission-kernel/src/mission-service/update-mission-lifecycle");
const resolve_approval_request_1 = require("../../../../packages/mission-kernel/src/approval-service/resolve-approval-request");
const read_mission_status_1 = require("../../../../packages/mission-kernel/src/resume-service/read-mission-status");
const read_mission_resume_1 = require("../../../../packages/mission-kernel/src/resume-service/read-mission-resume");
const read_ticket_board_1 = require("../../../../packages/ticket-runtime/src/planner/read-ticket-board");
const ticket_1 = require("../../../../packages/contracts/src/ticket/ticket");
const cancel_ticket_1 = require("../../../../packages/ticket-runtime/src/ticket-service/cancel-ticket");
const create_ticket_1 = require("../../../../packages/ticket-runtime/src/ticket-service/create-ticket");
const move_ticket_1 = require("../../../../packages/ticket-runtime/src/ticket-service/move-ticket");
const run_ticket_1 = require("../../../../packages/ticket-runtime/src/ticket-service/run-ticket");
const update_ticket_1 = require("../../../../packages/ticket-runtime/src/ticket-service/update-ticket");
const artifact_detail_formatter_1 = require("../formatters/artifact-detail-formatter");
const audit_entry_detail_formatter_1 = require("../formatters/audit-entry-detail-formatter");
const audit_log_formatter_1 = require("../formatters/audit-log-formatter");
const artifact_list_formatter_1 = require("../formatters/artifact-list-formatter");
const approval_queue_formatter_1 = require("../formatters/approval-queue-formatter");
const help_formatter_1 = require("../formatters/help-formatter");
const mission_compare_formatter_1 = require("../formatters/mission-compare-formatter");
const mission_extension_selection_formatter_1 = require("../formatters/mission-extension-selection-formatter");
const mission_status_formatter_1 = require("../formatters/mission-status-formatter");
const mission_resume_formatter_1 = require("../formatters/mission-resume-formatter");
const ticket_board_formatter_1 = require("../formatters/ticket-board-formatter");
async function runMissionCommand(args, output) {
    const [subcommand, ...rest] = args;
    if (!subcommand || subcommand === "help" || subcommand === "--help" || subcommand === "-h") {
        writeHelp(output);
        return 0;
    }
    if (subcommand === "bootstrap") {
        const rootDir = resolveRootDir(rest) ?? process.cwd();
        const result = await (0, bootstrap_mission_workspace_1.bootstrapMissionWorkspace)({ rootDir });
        output.writeLine(`Socle mission initialise dans ${result.rootDir}`);
        output.writeLine(`Journal local: ${result.journalPath}`);
        output.writeLine(`Projections locales: ${node_path_1.default.join(result.projectionsDir, "*.json")}`);
        return 0;
    }
    if (subcommand === "create") {
        const createOptions = parseCreateMissionArgs(rest);
        const rootDir = createOptions.rootDir ?? process.cwd();
        const result = await (0, create_mission_1.createMission)({
            rootDir,
            title: createOptions.title,
            objective: createOptions.objective,
            successCriteria: createOptions.successCriteria,
            policyProfileId: createOptions.policyProfileId,
        });
        output.writeLine(`Mission creee: ${result.mission.id}`);
        output.writeLine(`Workspace mission: ${result.missionDir}`);
        output.writeLine("Prochaine action suggeree: conservez cet identifiant pour les prochaines commandes mission.");
        return 0;
    }
    if (subcommand === "ticket") {
        return runMissionTicketCommand(rest, output);
    }
    if (subcommand === "extension") {
        return runMissionExtensionCommand(rest, output);
    }
    if (subcommand === "artifact") {
        return runMissionArtifactCommand(rest, output);
    }
    if (subcommand === "audit") {
        return runMissionAuditCommand(rest, output);
    }
    if (subcommand === "approval") {
        return runMissionApprovalCommand(rest, output);
    }
    if (subcommand === "compare") {
        return runMissionCompareCommand(rest, output);
    }
    if (subcommand === "status") {
        const readOptions = parseReadMissionArgs(rest, "status");
        const rootDir = readOptions.rootDir ?? process.cwd();
        const result = await (0, read_mission_status_1.readMissionStatus)({
            rootDir,
            missionId: readOptions.missionId,
        });
        for (const line of (0, mission_status_formatter_1.formatMissionStatus)(result.resume, result.ticketBoard.tickets)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (subcommand === "resume") {
        const readOptions = parseReadMissionArgs(rest, "resume");
        const rootDir = readOptions.rootDir ?? process.cwd();
        const result = await (0, read_mission_resume_1.readMissionResume)({
            rootDir,
            missionId: readOptions.missionId,
            commandName: "resume",
        });
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (subcommand === "pause"
        || subcommand === "relaunch"
        || subcommand === "close") {
        const lifecycleOptions = parseLifecycleMissionArgs(rest, subcommand);
        const rootDir = lifecycleOptions.rootDir ?? process.cwd();
        const result = await (0, update_mission_lifecycle_1.updateMissionLifecycle)({
            rootDir,
            missionId: lifecycleOptions.missionId,
            action: subcommand,
            outcome: lifecycleOptions.outcome,
        });
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande mission inconnue: ${subcommand}`);
    writeHelp(output);
    return 1;
}
function resolveRootDir(args) {
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            const value = args[index + 1];
            if (!value || value.startsWith("--")) {
                throw new Error("L'option --root exige un chemin de workspace.");
            }
            return value;
        }
        if (currentArg.startsWith("--root=")) {
            const value = currentArg.slice("--root=".length);
            if (!value) {
                throw new Error("L'option --root exige un chemin de workspace.");
            }
            return value;
        }
    }
    return undefined;
}
function parseCreateMissionArgs(args) {
    const options = {
        successCriteria: [],
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--title") {
            options.title = readOptionValue(args, index + 1, "--title");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--title=")) {
            options.title = readInlineOptionValue(currentArg, "--title");
            continue;
        }
        if (currentArg === "--objective") {
            options.objective = readOptionValue(args, index + 1, "--objective");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--objective=")) {
            options.objective = readInlineOptionValue(currentArg, "--objective");
            continue;
        }
        if (currentArg === "--success-criterion") {
            options.successCriteria.push(readOptionValue(args, index + 1, "--success-criterion"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--success-criterion=")) {
            options.successCriteria.push(readInlineOptionValue(currentArg, "--success-criterion"));
            continue;
        }
        if (currentArg === "--policy-profile") {
            options.policyProfileId = readOptionValue(args, index + 1, "--policy-profile");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--policy-profile=")) {
            options.policyProfileId = readInlineOptionValue(currentArg, "--policy-profile");
            continue;
        }
        throw new Error(`Argument de creation inconnu: ${currentArg}`);
    }
    return options;
}
function parseReadMissionArgs(args, commandName) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        throw new Error(`Argument de ${commandName} inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error(`L'option --mission-id est obligatoire pour \`corp mission ${commandName}\`.`);
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
    };
}
function parseSelectMissionExtensionsArgs(args) {
    const options = {
        allowedCapabilities: [],
        clearAllowedCapabilities: false,
        skillPackRefs: [],
        clearSkillPackRefs: false,
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--allow-capability") {
            options.allowedCapabilities.push(readOptionValue(args, index + 1, "--allow-capability"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--allow-capability=")) {
            options.allowedCapabilities.push(readInlineOptionValue(currentArg, "--allow-capability"));
            continue;
        }
        if (currentArg === "--clear-allow-capability") {
            options.clearAllowedCapabilities = true;
            continue;
        }
        if (currentArg === "--skill-pack") {
            options.skillPackRefs.push(readOptionValue(args, index + 1, "--skill-pack"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--skill-pack=")) {
            options.skillPackRefs.push(readInlineOptionValue(currentArg, "--skill-pack"));
            continue;
        }
        if (currentArg === "--clear-skill-pack") {
            options.clearSkillPackRefs = true;
            continue;
        }
        throw new Error(`Argument de mission extension select inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission extension select`.");
    }
    if (options.allowedCapabilities.length > 0 && options.clearAllowedCapabilities) {
        throw new Error("Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission extension select`.");
    }
    if (options.skillPackRefs.length > 0 && options.clearSkillPackRefs) {
        throw new Error("Les options `--skill-pack` et `--clear-skill-pack` sont incompatibles pour `corp mission extension select`.");
    }
    if (options.allowedCapabilities.length === 0
        && !options.clearAllowedCapabilities
        && options.skillPackRefs.length === 0
        && !options.clearSkillPackRefs) {
        throw new Error("Aucune mutation demandee pour `corp mission extension select`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        allowedCapabilities: options.allowedCapabilities,
        clearAllowedCapabilities: options.clearAllowedCapabilities,
        skillPackRefs: options.skillPackRefs,
        clearSkillPackRefs: options.clearSkillPackRefs,
    };
}
function parseApprovalDecisionArgs(args, commandName) {
    const options = {
        allowedCapabilities: [],
        clearAllowedCapabilities: false,
        skillPackRefs: [],
        clearSkillPackRefs: false,
        budgetObservations: [],
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--approval-id") {
            options.approvalId = readOptionValue(args, index + 1, "--approval-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--approval-id=")) {
            options.approvalId = readInlineOptionValue(currentArg, "--approval-id");
            continue;
        }
        if (currentArg === "--reason") {
            options.reason = readOptionValue(args, index + 1, "--reason");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--reason=")) {
            options.reason = readInlineOptionValue(currentArg, "--reason");
            continue;
        }
        if (currentArg === "--policy-profile") {
            options.policyProfileId = readOptionValue(args, index + 1, "--policy-profile");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--policy-profile=")) {
            options.policyProfileId = readInlineOptionValue(currentArg, "--policy-profile");
            continue;
        }
        if (currentArg === "--allow-capability") {
            options.allowedCapabilities.push(readOptionValue(args, index + 1, "--allow-capability"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--allow-capability=")) {
            options.allowedCapabilities.push(readInlineOptionValue(currentArg, "--allow-capability"));
            continue;
        }
        if (currentArg === "--clear-allow-capability") {
            options.clearAllowedCapabilities = true;
            continue;
        }
        if (currentArg === "--skill-pack") {
            options.skillPackRefs.push(readOptionValue(args, index + 1, "--skill-pack"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--skill-pack=")) {
            options.skillPackRefs.push(readInlineOptionValue(currentArg, "--skill-pack"));
            continue;
        }
        if (currentArg === "--clear-skill-pack") {
            options.clearSkillPackRefs = true;
            continue;
        }
        if (currentArg === "--budget-observation") {
            options.budgetObservations.push(readOptionValue(args, index + 1, "--budget-observation"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--budget-observation=")) {
            options.budgetObservations.push(readInlineOptionValue(currentArg, "--budget-observation"));
            continue;
        }
        throw new Error(`Argument de approval ${commandName} inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error(`L'option --mission-id est obligatoire pour \`corp mission approval ${commandName}\`.`);
    }
    if (!options.approvalId?.trim()) {
        throw new Error(`L'option --approval-id est obligatoire pour \`corp mission approval ${commandName}\`.`);
    }
    if (options.allowedCapabilities.length > 0 && options.clearAllowedCapabilities) {
        throw new Error(`Les options \`--allow-capability\` et \`--clear-allow-capability\` sont incompatibles pour \`corp mission approval ${commandName}\`.`);
    }
    if (options.skillPackRefs.length > 0 && options.clearSkillPackRefs) {
        throw new Error(`Les options \`--skill-pack\` et \`--clear-skill-pack\` sont incompatibles pour \`corp mission approval ${commandName}\`.`);
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        approvalId: options.approvalId,
        reason: options.reason,
        policyProfileId: options.policyProfileId,
        allowedCapabilities: options.allowedCapabilities,
        clearAllowedCapabilities: options.clearAllowedCapabilities,
        skillPackRefs: options.skillPackRefs,
        clearSkillPackRefs: options.clearSkillPackRefs,
        budgetObservations: options.budgetObservations,
    };
}
async function runMissionApprovalCommand(args, output) {
    const [approvalSubcommand, ...rest] = args;
    if (approvalSubcommand === "queue") {
        const readOptions = parseReadMissionArgs(rest, "approval queue");
        const rootDir = readOptions.rootDir ?? process.cwd();
        const result = await (0, read_approval_queue_1.readApprovalQueue)({
            rootDir,
            missionId: readOptions.missionId,
            commandName: "approval queue",
        });
        if (result.reconstructed) {
            await (0, read_mission_resume_1.readMissionResume)({
                rootDir,
                missionId: readOptions.missionId,
                commandName: "resume",
            });
        }
        output.writeLine(`Mission: ${result.mission.id}`);
        for (const line of (0, approval_queue_formatter_1.formatApprovalQueue)(result.approvals)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (approvalSubcommand === "approve"
        || approvalSubcommand === "reject"
        || approvalSubcommand === "defer") {
        const decisionOptions = parseApprovalDecisionArgs(rest, approvalSubcommand);
        const rootDir = decisionOptions.rootDir ?? process.cwd();
        const result = await (0, resolve_approval_request_1.resolveApprovalRequest)({
            rootDir,
            missionId: decisionOptions.missionId,
            approvalId: decisionOptions.approvalId,
            outcome: mapApprovalSubcommandToOutcome(approvalSubcommand),
            reason: decisionOptions.reason,
            policyProfileId: decisionOptions.policyProfileId,
            allowedCapabilities: decisionOptions.allowedCapabilities,
            clearAllowedCapabilities: decisionOptions.clearAllowedCapabilities,
            skillPackRefs: decisionOptions.skillPackRefs,
            clearSkillPackRefs: decisionOptions.clearSkillPackRefs,
            budgetObservations: decisionOptions.budgetObservations,
        });
        output.writeLine(`Approval resolue: ${result.approval.approvalId} (${result.decision.outcome})`);
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande mission approval inconnue: ${approvalSubcommand ?? ""}`.trimEnd());
    writeHelp(output);
    return 1;
}
async function runMissionCompareCommand(args, output) {
    const [compareSubcommand, ...rest] = args;
    if (!compareSubcommand || compareSubcommand.startsWith("--")) {
        const readOptions = parseReadMissionArgs(args, "compare");
        const rootDir = readOptions.rootDir ?? process.cwd();
        const result = await (0, read_mission_compare_1.readMissionCompare)({
            rootDir,
            missionId: readOptions.missionId,
            commandName: "compare",
        });
        for (const line of (0, mission_compare_formatter_1.formatMissionCompare)(result.compare)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (compareSubcommand === "relaunch") {
        const relaunchOptions = parseCompareRelaunchArgs(rest);
        const rootDir = relaunchOptions.rootDir ?? process.cwd();
        const result = await (0, relaunch_impacted_branch_1.relaunchImpactedBranch)({
            rootDir,
            missionId: relaunchOptions.missionId,
            ticketId: relaunchOptions.ticketId,
            background: relaunchOptions.background,
        });
        output.writeLine(`Tentative ouverte: ${result.run.attempt.id}`);
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.run.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande mission compare inconnue: ${compareSubcommand}`.trimEnd());
    writeHelp(output);
    return 1;
}
async function runMissionAuditCommand(args, output) {
    const [auditSubcommand, ...rest] = args;
    if (!auditSubcommand || auditSubcommand.startsWith("--")) {
        const listOptions = parseAuditListArgs(args);
        const rootDir = listOptions.rootDir ?? process.cwd();
        const result = await (0, read_mission_audit_1.readMissionAudit)({
            rootDir,
            missionId: listOptions.missionId,
            ticketId: listOptions.ticketId,
            limit: listOptions.limit,
        });
        output.writeLine(`Mission: ${result.mission.id}`);
        for (const line of (0, audit_log_formatter_1.formatAuditLog)(result.entries)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (auditSubcommand === "show") {
        const showOptions = parseAuditShowArgs(rest);
        const rootDir = showOptions.rootDir ?? process.cwd();
        const result = await (0, read_mission_audit_1.readMissionAuditEventDetail)({
            rootDir,
            missionId: showOptions.missionId,
            eventId: showOptions.eventId,
        });
        for (const line of (0, audit_entry_detail_formatter_1.formatAuditEntryDetail)(result.entry, {
            missionId: result.mission.id,
            fields: result.fields,
        })) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande mission audit inconnue: ${auditSubcommand}`.trimEnd());
    writeHelp(output);
    return 1;
}
async function runMissionExtensionCommand(args, output) {
    const [extensionSubcommand, ...rest] = args;
    if (extensionSubcommand === "select") {
        const selectOptions = parseSelectMissionExtensionsArgs(rest);
        const rootDir = selectOptions.rootDir ?? process.cwd();
        const result = await (0, select_mission_extensions_1.selectMissionExtensions)({
            rootDir,
            missionId: selectOptions.missionId,
            allowedCapabilities: selectOptions.allowedCapabilities,
            clearAllowedCapabilities: selectOptions.clearAllowedCapabilities,
            skillPackRefs: selectOptions.skillPackRefs,
            clearSkillPackRefs: selectOptions.clearSkillPackRefs,
        });
        for (const line of (0, mission_extension_selection_formatter_1.formatMissionExtensionSelection)(result.mission)) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande mission extension inconnue: ${extensionSubcommand ?? ""}`.trimEnd());
    writeHelp(output);
    return 1;
}
async function runMissionArtifactCommand(args, output) {
    const [artifactSubcommand, ...rest] = args;
    if (artifactSubcommand === "list") {
        const listOptions = parseArtifactListArgs(rest);
        const rootDir = listOptions.rootDir ?? process.cwd();
        const result = await (0, read_mission_artifacts_1.listMissionArtifacts)({
            rootDir,
            missionId: listOptions.missionId,
            ticketId: listOptions.ticketId,
        });
        for (const line of (0, artifact_list_formatter_1.formatArtifactList)(result.artifacts)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (artifactSubcommand === "show") {
        const showOptions = parseArtifactShowArgs(rest);
        const rootDir = showOptions.rootDir ?? process.cwd();
        const result = await (0, read_mission_artifacts_1.readMissionArtifactDetail)({
            rootDir,
            missionId: showOptions.missionId,
            artifactId: showOptions.artifactId,
        });
        for (const line of (0, artifact_detail_formatter_1.formatArtifactDetail)(result.artifact, {
            missionId: result.mission.id,
            payloadPreview: result.payloadPreview,
        })) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande mission artifact inconnue: ${artifactSubcommand ?? ""}`.trimEnd());
    writeHelp(output);
    return 1;
}
async function runMissionTicketCommand(args, output) {
    const [ticketSubcommand, ...rest] = args;
    if (ticketSubcommand === "board") {
        const boardOptions = parseReadMissionArgs(rest, "ticket board");
        const rootDir = boardOptions.rootDir ?? process.cwd();
        const result = await (0, read_ticket_board_1.readTicketBoard)({
            rootDir,
            missionId: boardOptions.missionId,
            commandName: "ticket board",
        });
        output.writeLine(`Mission: ${result.mission.id}`);
        for (const line of (0, ticket_board_formatter_1.formatTicketBoard)(result.board.tickets)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (ticketSubcommand === "create") {
        const createOptions = parseCreateTicketArgs(rest);
        const rootDir = createOptions.rootDir ?? process.cwd();
        const result = await (0, create_ticket_1.createTicket)({
            rootDir,
            missionId: createOptions.missionId,
            kind: createOptions.kind,
            goal: createOptions.goal,
            owner: createOptions.owner,
            dependsOn: createOptions.dependsOn,
            successCriteria: createOptions.successCriteria,
            allowedCapabilities: createOptions.allowedCapabilities,
            skillPackRefs: createOptions.skillPackRefs,
        });
        output.writeLine(`Ticket cree: ${result.ticket.id}`);
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (ticketSubcommand === "update") {
        const updateOptions = parseUpdateTicketArgs(rest);
        const rootDir = updateOptions.rootDir ?? process.cwd();
        const result = await (0, update_ticket_1.updateTicket)({
            rootDir,
            missionId: updateOptions.missionId,
            ticketId: updateOptions.ticketId,
            goal: updateOptions.goal,
            owner: updateOptions.owner,
            successCriteria: updateOptions.successCriteria,
            dependsOn: updateOptions.dependsOn,
            clearDependsOn: updateOptions.clearDependsOn,
            allowedCapabilities: updateOptions.allowedCapabilities,
            clearAllowedCapabilities: updateOptions.clearAllowedCapabilities,
            skillPackRefs: updateOptions.skillPackRefs,
            clearSkillPackRefs: updateOptions.clearSkillPackRefs,
        });
        output.writeLine(`Ticket mis a jour: ${result.ticket.id}`);
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (ticketSubcommand === "move") {
        const moveOptions = parseMoveTicketArgs(rest);
        const rootDir = moveOptions.rootDir ?? process.cwd();
        const result = await (0, move_ticket_1.moveTicket)({
            rootDir,
            missionId: moveOptions.missionId,
            ticketId: moveOptions.ticketId,
            strategy: moveOptions.strategy,
        });
        output.writeLine(`Ticket deplace: ${result.ticket.id}`);
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (ticketSubcommand === "cancel") {
        const cancelOptions = parseCancelTicketArgs(rest);
        const rootDir = cancelOptions.rootDir ?? process.cwd();
        const result = await (0, cancel_ticket_1.cancelTicket)({
            rootDir,
            missionId: cancelOptions.missionId,
            ticketId: cancelOptions.ticketId,
            reason: cancelOptions.reason,
        });
        output.writeLine(`Ticket annule: ${result.ticket.id}`);
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    if (ticketSubcommand === "run") {
        const runOptions = parseRunTicketArgs(rest);
        const rootDir = runOptions.rootDir ?? process.cwd();
        const result = await (0, run_ticket_1.runTicket)({
            rootDir,
            missionId: runOptions.missionId,
            ticketId: runOptions.ticketId,
            background: runOptions.background,
        });
        output.writeLine(`Tentative ouverte: ${result.attempt.id}`);
        for (const line of (0, mission_resume_formatter_1.formatMissionResume)(result.resume)) {
            output.writeLine(line);
        }
        return 0;
    }
    output.writeLine(`Commande mission ticket inconnue: ${ticketSubcommand ?? ""}`.trimEnd());
    writeHelp(output);
    return 1;
}
function parseLifecycleMissionArgs(args, commandName) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (commandName === "close" && currentArg === "--outcome") {
            options.outcome = parseCloseOutcome(readOptionValue(args, index + 1, "--outcome"));
            index += 1;
            continue;
        }
        if (commandName === "close" && currentArg.startsWith("--outcome=")) {
            options.outcome = parseCloseOutcome(readInlineOptionValue(currentArg, "--outcome"));
            continue;
        }
        throw new Error(`Argument de ${commandName} inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error(`L'option --mission-id est obligatoire pour \`corp mission ${commandName}\`.`);
    }
    if (commandName === "close" && !options.outcome) {
        throw new Error("L'option --outcome est obligatoire pour `corp mission close`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        outcome: options.outcome,
    };
}
function parseCompareRelaunchArgs(args) {
    const options = {
        background: false,
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--ticket-id") {
            options.ticketId = readOptionValue(args, index + 1, "--ticket-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--ticket-id=")) {
            options.ticketId = readInlineOptionValue(currentArg, "--ticket-id");
            continue;
        }
        if (currentArg === "--background") {
            options.background = true;
            continue;
        }
        throw new Error(`Argument de compare relaunch inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission compare relaunch`.");
    }
    if (!options.ticketId?.trim()) {
        throw new Error("L'option --ticket-id est obligatoire pour `corp mission compare relaunch`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
        background: options.background,
    };
}
function parseCreateTicketArgs(args) {
    const options = {
        dependsOn: [],
        successCriteria: [],
        allowedCapabilities: [],
        skillPackRefs: [],
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--kind") {
            options.kind = readOptionValue(args, index + 1, "--kind");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--kind=")) {
            options.kind = readInlineOptionValue(currentArg, "--kind");
            continue;
        }
        if (currentArg === "--goal") {
            options.goal = readOptionValue(args, index + 1, "--goal");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--goal=")) {
            options.goal = readInlineOptionValue(currentArg, "--goal");
            continue;
        }
        if (currentArg === "--owner") {
            options.owner = readOptionValue(args, index + 1, "--owner");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--owner=")) {
            options.owner = readInlineOptionValue(currentArg, "--owner");
            continue;
        }
        if (currentArg === "--depends-on") {
            options.dependsOn.push(readOptionValue(args, index + 1, "--depends-on"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--depends-on=")) {
            options.dependsOn.push(readInlineOptionValue(currentArg, "--depends-on"));
            continue;
        }
        if (currentArg === "--success-criterion") {
            options.successCriteria.push(readOptionValue(args, index + 1, "--success-criterion"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--success-criterion=")) {
            options.successCriteria.push(readInlineOptionValue(currentArg, "--success-criterion"));
            continue;
        }
        if (currentArg === "--allow-capability") {
            options.allowedCapabilities.push(readOptionValue(args, index + 1, "--allow-capability"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--allow-capability=")) {
            options.allowedCapabilities.push(readInlineOptionValue(currentArg, "--allow-capability"));
            continue;
        }
        if (currentArg === "--skill-pack") {
            options.skillPackRefs.push(readOptionValue(args, index + 1, "--skill-pack"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--skill-pack=")) {
            options.skillPackRefs.push(readInlineOptionValue(currentArg, "--skill-pack"));
            continue;
        }
        throw new Error(`Argument de ticket create inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission ticket create`.");
    }
    if (!options.kind?.trim()) {
        throw new Error("L'option --kind est obligatoire pour `corp mission ticket create`.");
    }
    if (!ticket_1.TICKET_KINDS.includes(options.kind)) {
        throw new Error("L'option --kind doit valoir `research`, `plan`, `implement`, `review` ou `operate` pour `corp mission ticket create`.");
    }
    if (!options.goal?.trim()) {
        throw new Error("L'option --goal est obligatoire pour `corp mission ticket create`.");
    }
    if (!options.owner?.trim()) {
        throw new Error("L'option --owner est obligatoire pour `corp mission ticket create`.");
    }
    if (!options.successCriteria.some((criterion) => criterion.trim().length > 0)) {
        throw new Error("Au moins un `--success-criterion` est obligatoire pour `corp mission ticket create`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        kind: options.kind,
        goal: options.goal,
        owner: options.owner,
        dependsOn: options.dependsOn,
        successCriteria: options.successCriteria,
        allowedCapabilities: options.allowedCapabilities,
        skillPackRefs: options.skillPackRefs,
    };
}
function parseUpdateTicketArgs(args) {
    const options = {
        successCriteria: [],
        dependsOn: [],
        clearDependsOn: false,
        allowedCapabilities: [],
        clearAllowedCapabilities: false,
        skillPackRefs: [],
        clearSkillPackRefs: false,
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--ticket-id") {
            options.ticketId = readOptionValue(args, index + 1, "--ticket-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--ticket-id=")) {
            options.ticketId = readInlineOptionValue(currentArg, "--ticket-id");
            continue;
        }
        if (currentArg === "--goal") {
            options.goal = readOptionValue(args, index + 1, "--goal");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--goal=")) {
            options.goal = readInlineOptionValue(currentArg, "--goal");
            continue;
        }
        if (currentArg === "--owner") {
            options.owner = readOptionValue(args, index + 1, "--owner");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--owner=")) {
            options.owner = readInlineOptionValue(currentArg, "--owner");
            continue;
        }
        if (currentArg === "--success-criterion") {
            options.successCriteria.push(readOptionValue(args, index + 1, "--success-criterion"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--success-criterion=")) {
            options.successCriteria.push(readInlineOptionValue(currentArg, "--success-criterion"));
            continue;
        }
        if (currentArg === "--depends-on") {
            options.dependsOn.push(readOptionValue(args, index + 1, "--depends-on"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--depends-on=")) {
            options.dependsOn.push(readInlineOptionValue(currentArg, "--depends-on"));
            continue;
        }
        if (currentArg === "--clear-depends-on") {
            options.clearDependsOn = true;
            continue;
        }
        if (currentArg === "--allow-capability") {
            options.allowedCapabilities.push(readOptionValue(args, index + 1, "--allow-capability"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--allow-capability=")) {
            options.allowedCapabilities.push(readInlineOptionValue(currentArg, "--allow-capability"));
            continue;
        }
        if (currentArg === "--clear-allow-capability") {
            options.clearAllowedCapabilities = true;
            continue;
        }
        if (currentArg === "--skill-pack") {
            options.skillPackRefs.push(readOptionValue(args, index + 1, "--skill-pack"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--skill-pack=")) {
            options.skillPackRefs.push(readInlineOptionValue(currentArg, "--skill-pack"));
            continue;
        }
        if (currentArg === "--clear-skill-pack") {
            options.clearSkillPackRefs = true;
            continue;
        }
        throw new Error(`Argument de ticket update inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission ticket update`.");
    }
    if (!options.ticketId?.trim()) {
        throw new Error("L'option --ticket-id est obligatoire pour `corp mission ticket update`.");
    }
    if (options.dependsOn.length > 0 && options.clearDependsOn) {
        throw new Error("Les options `--depends-on` et `--clear-depends-on` sont incompatibles pour `corp mission ticket update`.");
    }
    if (options.allowedCapabilities.length > 0 && options.clearAllowedCapabilities) {
        throw new Error("Les options `--allow-capability` et `--clear-allow-capability` sont incompatibles pour `corp mission ticket update`.");
    }
    if (options.skillPackRefs.length > 0 && options.clearSkillPackRefs) {
        throw new Error("Les options `--skill-pack` et `--clear-skill-pack` sont incompatibles pour `corp mission ticket update`.");
    }
    if (!hasAnyUpdateMutation(options)) {
        throw new Error("Aucune mutation demandee pour `corp mission ticket update`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
        goal: options.goal,
        owner: options.owner,
        successCriteria: options.successCriteria,
        dependsOn: options.dependsOn,
        clearDependsOn: options.clearDependsOn,
        allowedCapabilities: options.allowedCapabilities,
        clearAllowedCapabilities: options.clearAllowedCapabilities,
        skillPackRefs: options.skillPackRefs,
        clearSkillPackRefs: options.clearSkillPackRefs,
    };
}
function parseMoveTicketArgs(args) {
    const options = {
        strategies: [],
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--ticket-id") {
            options.ticketId = readOptionValue(args, index + 1, "--ticket-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--ticket-id=")) {
            options.ticketId = readInlineOptionValue(currentArg, "--ticket-id");
            continue;
        }
        if (currentArg === "--before-ticket") {
            options.strategies.push({
                type: "before-ticket",
                referenceTicketId: readOptionValue(args, index + 1, "--before-ticket"),
            });
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--before-ticket=")) {
            options.strategies.push({
                type: "before-ticket",
                referenceTicketId: readInlineOptionValue(currentArg, "--before-ticket"),
            });
            continue;
        }
        if (currentArg === "--after-ticket") {
            options.strategies.push({
                type: "after-ticket",
                referenceTicketId: readOptionValue(args, index + 1, "--after-ticket"),
            });
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--after-ticket=")) {
            options.strategies.push({
                type: "after-ticket",
                referenceTicketId: readInlineOptionValue(currentArg, "--after-ticket"),
            });
            continue;
        }
        if (currentArg === "--to-front") {
            options.strategies.push({ type: "to-front" });
            continue;
        }
        if (currentArg === "--to-back") {
            options.strategies.push({ type: "to-back" });
            continue;
        }
        throw new Error(`Argument de ticket move inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission ticket move`.");
    }
    if (!options.ticketId?.trim()) {
        throw new Error("L'option --ticket-id est obligatoire pour `corp mission ticket move`.");
    }
    if (options.strategies.length !== 1) {
        throw new Error("Choisissez exactement une strategie de deplacement pour `corp mission ticket move`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
        strategy: options.strategies[0],
    };
}
function parseCancelTicketArgs(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--ticket-id") {
            options.ticketId = readOptionValue(args, index + 1, "--ticket-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--ticket-id=")) {
            options.ticketId = readInlineOptionValue(currentArg, "--ticket-id");
            continue;
        }
        if (currentArg === "--reason") {
            options.reason = readOptionValue(args, index + 1, "--reason");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--reason=")) {
            options.reason = readInlineOptionValue(currentArg, "--reason");
            continue;
        }
        throw new Error(`Argument de ticket cancel inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission ticket cancel`.");
    }
    if (!options.ticketId?.trim()) {
        throw new Error("L'option --ticket-id est obligatoire pour `corp mission ticket cancel`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
        reason: options.reason,
    };
}
function parseRunTicketArgs(args) {
    const options = {
        background: false,
    };
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--ticket-id") {
            options.ticketId = readOptionValue(args, index + 1, "--ticket-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--ticket-id=")) {
            options.ticketId = readInlineOptionValue(currentArg, "--ticket-id");
            continue;
        }
        if (currentArg === "--background") {
            options.background = true;
            continue;
        }
        throw new Error(`Argument de ticket run inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission ticket run`.");
    }
    if (!options.ticketId?.trim()) {
        throw new Error("L'option --ticket-id est obligatoire pour `corp mission ticket run`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
        background: options.background,
    };
}
function parseArtifactListArgs(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--ticket-id") {
            options.ticketId = readOptionValue(args, index + 1, "--ticket-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--ticket-id=")) {
            options.ticketId = readInlineOptionValue(currentArg, "--ticket-id");
            continue;
        }
        throw new Error(`Argument de artifact list inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission artifact list`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
    };
}
function parseArtifactShowArgs(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--artifact-id") {
            options.artifactId = readOptionValue(args, index + 1, "--artifact-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--artifact-id=")) {
            options.artifactId = readInlineOptionValue(currentArg, "--artifact-id");
            continue;
        }
        throw new Error(`Argument de artifact show inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission artifact show`.");
    }
    if (!options.artifactId?.trim()) {
        throw new Error("L'option --artifact-id est obligatoire pour `corp mission artifact show`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        artifactId: options.artifactId,
    };
}
function parseAuditListArgs(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--ticket-id") {
            options.ticketId = readOptionValue(args, index + 1, "--ticket-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--ticket-id=")) {
            options.ticketId = readInlineOptionValue(currentArg, "--ticket-id");
            continue;
        }
        if (currentArg === "--limit") {
            options.limit = parseAuditLimit(readOptionValue(args, index + 1, "--limit"));
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--limit=")) {
            options.limit = parseAuditLimit(readInlineOptionValue(currentArg, "--limit"));
            continue;
        }
        throw new Error(`Argument de audit inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission audit`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        ticketId: options.ticketId,
        limit: options.limit,
    };
}
function parseAuditShowArgs(args) {
    const options = {};
    for (let index = 0; index < args.length; index += 1) {
        const currentArg = args[index];
        if (currentArg === "--root") {
            options.rootDir = readOptionValue(args, index + 1, "--root");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--root=")) {
            options.rootDir = readInlineOptionValue(currentArg, "--root");
            continue;
        }
        if (currentArg === "--mission-id") {
            options.missionId = readOptionValue(args, index + 1, "--mission-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--mission-id=")) {
            options.missionId = readInlineOptionValue(currentArg, "--mission-id");
            continue;
        }
        if (currentArg === "--event-id") {
            options.eventId = readOptionValue(args, index + 1, "--event-id");
            index += 1;
            continue;
        }
        if (currentArg.startsWith("--event-id=")) {
            options.eventId = readInlineOptionValue(currentArg, "--event-id");
            continue;
        }
        throw new Error(`Argument de audit show inconnu: ${currentArg}`);
    }
    if (!options.missionId?.trim()) {
        throw new Error("L'option --mission-id est obligatoire pour `corp mission audit show`.");
    }
    if (!options.eventId?.trim()) {
        throw new Error("L'option --event-id est obligatoire pour `corp mission audit show`.");
    }
    return {
        rootDir: options.rootDir,
        missionId: options.missionId,
        eventId: options.eventId,
    };
}
function hasAnyUpdateMutation(options) {
    return options.goal !== undefined
        || options.owner !== undefined
        || options.successCriteria.length > 0
        || options.dependsOn.length > 0
        || options.clearDependsOn
        || options.allowedCapabilities.length > 0
        || options.clearAllowedCapabilities
        || options.skillPackRefs.length > 0
        || options.clearSkillPackRefs;
}
function readOptionValue(args, valueIndex, optionName) {
    const value = args[valueIndex];
    if (value === undefined || value.startsWith("--")) {
        throw new Error(`L'option ${optionName} exige une valeur.`);
    }
    return value;
}
function readInlineOptionValue(argument, optionName) {
    const value = argument.slice(`${optionName}=`.length);
    if (!value) {
        throw new Error(`L'option ${optionName} exige une valeur.`);
    }
    return value;
}
function parseAuditLimit(value) {
    if (!/^\d+$/.test(value)) {
        throw new Error("L'option --limit doit etre un entier strictement positif pour `corp mission audit`.");
    }
    const limit = Number(value);
    if (!Number.isSafeInteger(limit) || limit <= 0) {
        throw new Error("L'option --limit doit etre un entier strictement positif pour `corp mission audit`.");
    }
    return limit;
}
function parseCloseOutcome(value) {
    if (value === "completed" || value === "cancelled") {
        return value;
    }
    throw new Error("L'option --outcome doit valoir `completed` ou `cancelled` pour `corp mission close`.");
}
function mapApprovalSubcommandToOutcome(approvalSubcommand) {
    if (approvalSubcommand === "approve") {
        return "approved";
    }
    if (approvalSubcommand === "reject") {
        return "rejected";
    }
    return "deferred";
}
function writeHelp(output) {
    for (const line of (0, help_formatter_1.formatMissionHelp)()) {
        output.writeLine(line);
    }
}
