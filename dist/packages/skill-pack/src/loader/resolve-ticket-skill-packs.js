"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveTicketSkillPacks = resolveTicketSkillPacks;
const build_skill_pack_summary_1 = require("../metadata/build-skill-pack-summary");
const assert_skill_pack_local_boundary_1 = require("../references/assert-skill-pack-local-boundary");
const read_registered_skill_pack_1 = require("./read-registered-skill-pack");
async function resolveTicketSkillPacks(options) {
    if (options.ticket.skillPackRefs.length === 0) {
        return [];
    }
    const uniquePackRefs = [...new Set(options.ticket.skillPackRefs)];
    const summaries = [];
    for (const packRef of uniquePackRefs) {
        const registeredSkillPack = await (0, read_registered_skill_pack_1.readRegisteredSkillPack)({
            repository: options.repository,
            packRef,
        });
        (0, assert_skill_pack_local_boundary_1.assertSkillPackLocalBoundary)({
            packRef: registeredSkillPack.packRef,
            localRefs: registeredSkillPack.localRefs,
        });
        summaries.push((0, build_skill_pack_summary_1.buildSkillPackSummary)(registeredSkillPack));
    }
    return summaries;
}
