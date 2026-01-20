"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JiraIssuesService = void 0;
exports.createIssuesService = createIssuesService;
const api_1 = require("../config/api");
const index_1 = require("../config/index");
const bulk_operations_1 = require("../tools/bulk-operations");
class JiraIssuesService {
    baseUrl;
    headers;
    requestTimeout = 30000;
    constructor(baseUrl, token, isOauth = false) {
        this.baseUrl = baseUrl;
        this.headers = (0, api_1.createJiraApiHeaders)(token, isOauth);
    }
    async handleFetchError(response) {
        if (!response.ok) {
            let message = response.statusText;
            let errorData = {};
            try {
                errorData = await response.json();
                if (Array.isArray(errorData.errorMessages) && errorData.errorMessages.length > 0) {
                    message = errorData.errorMessages.join("; ");
                }
                else if (errorData.message) {
                    message = errorData.message;
                }
                else if (errorData.errorMessage) {
                    message = errorData.errorMessage;
                }
            }
            catch (e) {
                console.warn("Could not parse JIRA error response body as JSON.");
            }
            const details = JSON.stringify(errorData, null, 2);
            console.error("JIRA API Error Details:", details);
            const errorMessage = message ? `: ${message}` : "";
            throw new Error(`JIRA API Error${errorMessage} (Status: ${response.status})`);
        }
        throw new Error("Unknown error occurred during fetch operation.");
    }
    async fetchJson(url, init) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        try {
            const response = await fetch(url, {
                ...init,
                headers: {
                    ...Object.fromEntries(this.headers.entries()),
                    ...(init?.headers || {}),
                },
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                await this.handleFetchError(response);
            }
            return await response.json();
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.requestTimeout}ms`);
            }
            throw error;
        }
    }
    extractIssueMentions(content, source, commentId) {
        const mentions = [];
        const processNode = (node) => {
            if (node.type === "inlineCard" && node.attrs?.url) {
                const match = node.attrs.url.match(/\/browse\/([A-Z]+-\d+)/);
                if (match) {
                    mentions.push({
                        key: match[1],
                        type: "mention",
                        source,
                        commentId,
                    });
                }
            }
            if (node.type === "text" && node.text) {
                const matches = node.text.match(/[A-Z]+-\d+/g) || [];
                matches.forEach((key) => {
                    mentions.push({
                        key,
                        type: "mention",
                        source,
                        commentId,
                    });
                });
            }
            if (node.content) {
                node.content.forEach(processNode);
            }
        };
        content.forEach(processNode);
        return Array.from(new Map(mentions.map((m) => [m.key, m])).values());
    }
    extractTextContent(content) {
        if (!Array.isArray(content))
            return "";
        return content
            .map((node) => {
            if (node.type === "text") {
                return node.text || "";
            }
            if (node.content) {
                return this.extractTextContent(node.content);
            }
            return "";
        })
            .join("");
    }
    cleanIssue(issue) {
        // Handle both Jira Server (plain text) and Jira Cloud (ADF format)
        let description = "";
        if (issue.fields?.description) {
            if (typeof issue.fields.description === 'string') {
                // Jira Server API v2: plain text
                description = issue.fields.description;
            } else if (issue.fields.description.content) {
                // Jira Cloud API v3: ADF format
                description = this.extractTextContent(issue.fields.description.content);
            }
        }
        const cleanedIssue = {
            id: issue.id,
            key: issue.key,
            summary: issue.fields?.summary,
            status: issue.fields?.status?.name,
            created: issue.fields?.created,
            updated: issue.fields?.updated,
            // comments: issue.fields?.comment,
            description,
            timetracking: issue.fields?.timetracking,
            worklogs: issue.fields?.worklog,
            assignee: issue.fields?.assignee?.displayName,
        };
        // if (issue.fields?.description?.content) {
        //   const mentions = this.extractIssueMentions(
        //     issue.fields.description.content,
        //     "description"
        //   );
        //   if (mentions && mentions.length > 0) {
        //     cleanedIssue.relatedIssues = mentions;
        //   }
        // }
        // if (issue.fields?.issuelinks?.length > 0) {
        //   const links = issue.fields.issuelinks.map((link: any) => {
        //     const linkedIssue = link.inwardIssue || link.outwardIssue;
        //     const relationship = link.type.inward || link.type.outward;
        //     return {
        //       key: linkedIssue.key,
        //       summary: linkedIssue.fields?.summary,
        //       type: "link" as const,
        //       relationship,
        //       source: "description" as const,
        //     };
        //   });
        //   cleanedIssue.relatedIssues = [
        //     ...(cleanedIssue.relatedIssues || []),
        //     ...links,
        //   ];
        // }
        return cleanedIssue;
    }
    async searchIssues(searchString, pageSize = 100, minimalFields = false, startAt = 0) {
        (0, bulk_operations_1.debugLog)("searchIssues", minimalFields);
        const fields = minimalFields
            ? "summary,status,created,updated,assignee,project"
            : "summary,assignee,status,created,updated,comment,description,timetracking,worklog,project";
        // Use 'search' endpoint (not 'search/jql') for Jira Server compatibility
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `search?jql=${encodeURIComponent(searchString)}&maxResults=${pageSize}&startAt=${startAt}&expand=changelog&fields=${fields}`);
        (0, bulk_operations_1.debugLog)("url", url);
        const response = await this.fetchJson(url);
        (0, bulk_operations_1.debugLog)("response", response);
        return {
            issues: response.issues || [],
            total: response.total || 0,
            startAt: response.startAt || 0,
            hasNextPage: response?.total > startAt + pageSize,
        };
    }
    // Enhanced searchIssues method with pagination support
    // async searchIssues(
    //   searchString: string,
    //   maxResults: number = 100,
    //   getAllResults: boolean = true,
    //   minimalFields: boolean = false
    // ): Promise<SearchIssuesResponse> {
    //  // Use minimal fields for better performance
    //  const fields = minimalFields
    //  ? 'summary,status,created,updated,assignee'
    //  : 'summary,assignee,status,created,updated,comment,description,timetracking,worklog';
    //  const pageSize = Math.min(maxResults, 100); // JIRA API typically limits to 100 per request
    //   let allIssues: CleanJiraIssue[] = [];
    //   let startAt = 0;
    //   let totalResults = 0;
    //   let hasMoreResults = true;
    //   while (hasMoreResults) {
    //     const url = getJiraApiUrl(
    //       this.baseUrl,
    //       `search?jql=${encodeURIComponent(searchString)}&maxResults=${pageSize}&startAt=${startAt}&expand=changelog&fields=${fields}`
    //     );
    //     const response = await this.fetchJson<any>(url);
    //     // Clean and add issues from this page
    //     const cleanedIssues = response.issues?.map((issue: any) => this.cleanIssue(issue)) || [];
    //     allIssues = allIssues.concat(cleanedIssues);
    //     // Update pagination info
    //     totalResults = response.total || 0;
    //     startAt += pageSize;
    //     // Determine if we should continue
    //     if (getAllResults) {
    //       // Continue until we have all results
    //       hasMoreResults = allIssues.length < totalResults;
    //     } else {
    //       // Continue until we reach the requested maxResults or run out of results
    //       hasMoreResults = allIssues.length < maxResults && allIssues.length < totalResults;
    //     }
    //     // Safety check to prevent infinite loops
    //     if (startAt > 10000) { // JIRA typically has a limit around 10k results
    //       console.warn('Reached maximum pagination limit (10,000 results). Some results may be missing.');
    //       break;
    //     }
    //   }
    //   console.log(allIssues?.length, 'allIssues');
    //   return {
    //     issues: getAllResults ? allIssues : allIssues.slice(0, maxResults),
    //     total: totalResults,
    //     startAt: 0,
    //   };
    // }
    async getIssueWithComments(issueId, maxComments = 50) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `issue/${issueId}?expand=comments,changelog,worklog&fields=*all&maxResults=${maxComments}`);
        const issue = await this.fetchJson(url);
        return this.cleanIssue(issue);
    }
    async createIssue(projectKey, issueType, summary, description, fields) {
        const issueData = {
            fields: {
                project: { key: projectKey },
                issuetype: { name: issueType },
                summary,
                ...fields,
            },
        };
        if (description) {
            issueData.fields.description = this.createAdfFromBody(description);
        }
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, "issue");
        return await this.fetchJson(url, {
            method: "POST",
            body: JSON.stringify(issueData),
        });
    }
    async updateIssue(issueKey, fields) {
        // Transform description field if present (Jira Cloud needs ADF format)
        const transformedFields = { ...fields };
        if (transformedFields.description !== undefined) {
            transformedFields.description = this.createAdfFromBody(transformedFields.description);
        }

        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `issue/${issueKey}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: Object.fromEntries(this.headers.entries()),
                body: JSON.stringify({ fields: transformedFields }),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                await this.handleFetchError(response);
            }
            // Jira Server returns 204 No Content on successful update
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.requestTimeout}ms`);
            }
            throw error;
        }
    }
    async deleteIssue(issueKey) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `issue/${issueKey}`);
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        try {
            const response = await fetch(url, {
                method: "DELETE",
                headers: Object.fromEntries(this.headers.entries()),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                await this.handleFetchError(response);
            }
            // Jira Server returns 204 No Content on successful delete
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.requestTimeout}ms`);
            }
            throw error;
        }
    }
    async getTransitions(issueKey) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `issue/${issueKey}/transitions`);
        const response = await this.fetchJson(url);
        return response.transitions || [];
    }
    async transitionIssue(issueKey, transitionId, comment) {
        const transitionData = {
            transition: { id: transitionId },
        };
        if (comment) {
            transitionData.update = {
                comment: [
                    {
                        add: {
                            body: this.createAdfFromBody(comment),
                        },
                    },
                ],
            };
        }
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `issue/${issueKey}/transitions`);
        await this.fetchJson(url, {
            method: "POST",
            body: JSON.stringify(transitionData),
        });
    }
    async assignIssue(issueKey, accountId) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `issue/${issueKey}/assignee`);
        // Jira Server uses 'name', Jira Cloud uses 'accountId'
        const body = index_1.config.jira.type === 'server'
            ? { name: accountId }
            : { accountId };
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.requestTimeout);
        try {
            const response = await fetch(url, {
                method: "PUT",
                headers: Object.fromEntries(this.headers.entries()),
                body: JSON.stringify(body),
                signal: controller.signal,
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                await this.handleFetchError(response);
            }
            // Jira Server returns 204 No Content on successful assign
        }
        catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof Error && error.name === 'AbortError') {
                throw new Error(`Request timeout after ${this.requestTimeout}ms`);
            }
            throw error;
        }
    }
    createAdfFromBody(text) {
        // Jira Server API v2 uses plain text, Jira Cloud API v3 uses ADF
        if (index_1.config.jira.type === 'server') {
            return text;
        }
        return {
            type: "doc",
            version: 1,
            content: [
                {
                    type: "paragraph",
                    content: [
                        {
                            type: "text",
                            text: text,
                        },
                    ],
                },
            ],
        };
    }
    async addCommentToIssue(issueIdOrKey, body) {
        const url = (0, api_1.getJiraApiUrl)(this.baseUrl, `issue/${issueIdOrKey}/comment`);
        const commentData = {
            body: this.createAdfFromBody(body),
        };
        return await this.fetchJson(url, {
            method: "POST",
            body: JSON.stringify(commentData),
        });
    }
    setRequestTimeout(timeout) {
        this.requestTimeout = timeout;
    }
    getRequestTimeout() {
        return this.requestTimeout;
    }
}
exports.JiraIssuesService = JiraIssuesService;
// Factory function to create service instance
function createIssuesService(baseUrl, token, isOauth = false) {
    return new JiraIssuesService(baseUrl, token, isOauth);
}
