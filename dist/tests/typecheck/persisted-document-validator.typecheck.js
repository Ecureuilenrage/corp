"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const persisted_document_guards_1 = require("../../packages/contracts/src/guards/persisted-document-guards");
const persisted_document_errors_1 = require("../../packages/storage/src/repositories/persisted-document-errors");
const context = {
    filePath: "C:/tmp/mission.json",
    entityLabel: "Mission",
    documentId: "mission_typecheck",
};
const candidate = {
    id: "mission_typecheck",
};
(0, persisted_document_errors_1.assertValidPersistedDocument)(candidate, persisted_document_guards_1.validateMission, context);
// @ts-expect-error validateMission ne peut pas asserter un string.
(0, persisted_document_errors_1.assertValidPersistedDocument)(candidate, persisted_document_guards_1.validateMission, context);
