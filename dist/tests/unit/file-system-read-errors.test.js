"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = __importDefault(require("node:test"));
const file_system_read_errors_1 = require("../../packages/storage/src/fs-layout/file-system-read-errors");
for (const osCode of ["EBUSY", "ETIMEDOUT"]) {
    (0, node_test_1.default)(`isFileSystemReadError classe ${osCode} comme erreur de lecture`, () => {
        const error = new Error(`${osCode}: simulated`);
        error.code = osCode;
        strict_1.default.equal((0, file_system_read_errors_1.isFileSystemReadError)(error), true);
    });
}
