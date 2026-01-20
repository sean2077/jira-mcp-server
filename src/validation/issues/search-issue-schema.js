"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchIssueSchema = void 0;
const zod_1 = require("zod");
exports.searchIssueSchema = zod_1.z.object({
    searchString: zod_1.z.string().min(1).describe("JQL query string to search for issues"),
    cloudId: zod_1.z.string().optional().describe("Cloud ID if different from default")
});
