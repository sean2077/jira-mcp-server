"use strict";
// Shared Jira REST fetch helpers.
// Every service class used to carry an identical copy of handleFetchError + fetchJson plus, in
// issues.js, ~8 copies of the same AbortController/timeout block for no-body writes. These helpers
// are the single source of truth for that behaviour.
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleFetchError = handleFetchError;
exports.jiraFetchJson = jiraFetchJson;
exports.jiraFetchVoid = jiraFetchVoid;

// Extract the most specific Jira error message available and throw. Only call for !response.ok.
async function handleFetchError(response) {
    let message = response.statusText;
    let errorData = {};
    try {
        errorData = await response.json();
        // Jira returns top-level errorMessages plus a field-level `errors` map (e.g. validation
        // failures on create/update). Combine both so the thrown message keeps the useful detail.
        const parts = [];
        if (Array.isArray(errorData.errorMessages)) {
            parts.push(...errorData.errorMessages);
        }
        if (errorData.errors && typeof errorData.errors === "object" && !Array.isArray(errorData.errors)) {
            for (const [field, msg] of Object.entries(errorData.errors)) {
                parts.push(`${field}: ${msg}`);
            }
        }
        if (parts.length > 0) {
            message = parts.join("; ");
        }
        else if (errorData.message) {
            message = errorData.message;
        }
        else if (errorData.errorMessage) {
            message = errorData.errorMessage;
        }
    }
    catch (e) {
        // stderr is safe for an stdio MCP server (stdout is the JSON-RPC channel)
        console.warn("Could not parse JIRA error response body as JSON.");
    }
    console.error("JIRA API Error Details:", JSON.stringify(errorData, null, 2));
    const errorMessage = message ? `: ${message}` : "";
    throw new Error(`JIRA API Error${errorMessage} (Status: ${response.status})`);
}

// Perform a fetch with a hard timeout, merging the service's default headers with any per-call
// headers, and converting a non-ok response into a thrown Jira error. Returns the raw Response.
async function jiraRequest(url, headers, init, timeout) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(url, {
            ...init,
            headers: {
                ...Object.fromEntries(headers.entries()),
                ...(init?.headers || {}),
            },
            signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            await handleFetchError(response);
        }
        return response;
    }
    catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error(`Request timeout after ${timeout}ms`);
        }
        throw error;
    }
}

// For endpoints that return a JSON body.
async function jiraFetchJson(url, headers, init, timeout) {
    const response = await jiraRequest(url, headers, init, timeout);
    return await response.json();
}

// For Jira write endpoints that return 204/201 with no body: never parse JSON.
async function jiraFetchVoid(url, headers, init, timeout) {
    await jiraRequest(url, headers, init, timeout);
}
