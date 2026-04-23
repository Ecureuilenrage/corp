import { validateMission } from "../../packages/contracts/src/guards/persisted-document-guards";
import {
  assertValidPersistedDocument,
  type PersistedDocumentContext,
} from "../../packages/storage/src/repositories/persisted-document-errors";

const context: PersistedDocumentContext = {
  filePath: "C:/tmp/mission.json",
  entityLabel: "Mission",
  documentId: "mission_typecheck",
};

const candidate: unknown = {
  id: "mission_typecheck",
};

assertValidPersistedDocument(candidate, validateMission, context);

// @ts-expect-error validateMission ne peut pas asserter un string.
assertValidPersistedDocument<string>(candidate, validateMission, context);

export {};
