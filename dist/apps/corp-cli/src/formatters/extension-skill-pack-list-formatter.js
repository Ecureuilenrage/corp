"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatExtensionSkillPackList = formatExtensionSkillPackList;
function formatExtensionSkillPackList(result) {
    const lines = [
        `Skill packs valides: ${formatValidCount(result.valid.length)}`,
    ];
    for (const skillPack of result.valid) {
        lines.push(`- ${skillPack.packRef} | displayName=${skillPack.displayName} | version=${skillPack.version} | owner=${skillPack.metadata.owner}`);
    }
    lines.push(`Diagnostics invalides: ${formatInvalidCount(result.invalid.length)}`);
    for (const diagnostic of result.invalid) {
        lines.push(formatDiagnostic(diagnostic));
    }
    return lines;
}
function formatValidCount(count) {
    return count === 0 ? "aucun" : String(count);
}
function formatInvalidCount(count) {
    return count === 0 ? "aucun" : String(count);
}
function formatDiagnostic(diagnostic) {
    return `- ${diagnostic.packRef} | code=${diagnostic.code} | fichier=${diagnostic.filePath} | message=${diagnostic.message}`;
}
