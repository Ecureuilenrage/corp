"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.readRegisteredCapability = readRegisteredCapability;
async function readRegisteredCapability(options) {
    const registeredCapability = await options.repository.findByCapabilityId(options.capabilityId);
    if (!registeredCapability) {
        throw new Error(`Capability introuvable dans le registre local: ${options.capabilityId}.`);
    }
    return registeredCapability;
}
