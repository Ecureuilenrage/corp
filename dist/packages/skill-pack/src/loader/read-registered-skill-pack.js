"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRegisteredSkillPack = readRegisteredSkillPack;
async function readRegisteredSkillPack(options) {
    const registeredSkillPack = await options.repository.findByPackRef(options.packRef);
    if (!registeredSkillPack) {
        throw new Error(`Skill pack introuvable dans le registre local: ${options.packRef}.`);
    }
    return registeredSkillPack;
}
