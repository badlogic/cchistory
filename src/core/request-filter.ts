/**
 * Pure functions for filtering and selecting Claude API requests
 */

import type { RequestResponsePair, Tool } from "../types/request.js";

/**
 * Filter out Haiku model requests
 * @param pairs - Array of request/response pairs
 * @returns Pairs not using Haiku models
 */
export function filterNonHaikuRequests(pairs: RequestResponsePair[]): RequestResponsePair[] {
	return pairs.filter((pair) => pair.request?.body?.model && !pair.request.body.model.toLowerCase().includes("haiku"));
}

/**
 * Filter requests that have tools defined
 * @param pairs - Array of request/response pairs
 * @returns Pairs with tools
 */
export function filterRequestsWithTools(pairs: RequestResponsePair[]): RequestResponsePair[] {
	return pairs.filter(
		(pair) =>
			pair.request?.body?.tools && Array.isArray(pair.request.body.tools) && pair.request.body.tools.length > 0,
	);
}

/**
 * Select the best request from candidates
 * Prefers non-Haiku requests with tools, sorted by tool count (descending)
 * Falls back to any non-Haiku request if no tools found
 * @param pairs - Array of request/response pairs
 * @returns The best request, or undefined if none found
 * @throws Error if no suitable request is found
 */
export function selectBestRequest(pairs: RequestResponsePair[]): RequestResponsePair {
	// First try to find requests with tools
	const nonHaikuPairs = filterNonHaikuRequests(pairs);
	const requestsWithToolsAndSystemPrompt = filterRequestsWithTools(nonHaikuPairs).filter(
		(pair) => pair.request.body.system,
	);

	if (requestsWithToolsAndSystemPrompt.length > 0) {
		// Sort by tool count (descending) and return the best
		const sorted = requestsWithToolsAndSystemPrompt.sort(
			(a, b) => (b.request.body.tools?.length || 0) - (a.request.body.tools?.length || 0),
		);
		return sorted[0];
	}

	// Fallback to any non-Haiku request
	if (nonHaikuPairs.length > 0) {
		return nonHaikuPairs[0];
	}

	throw new Error("No non-Haiku request found in the log");
}

/**
 * Filter out MCP tools and sort tools by name
 * @param tools - Array of tools
 * @returns Filtered and sorted tools
 */
export function filterAndSortTools(tools: Tool[] | undefined): Tool[] {
	if (!tools) return [];

	return tools.filter((tool) => !tool.name.startsWith("mcp__")).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Check if selected request has tools (for warning purposes)
 * @param pair - Request/response pair
 * @returns True if request has tools
 */
export function hasTools(pair: RequestResponsePair): boolean {
	return !!pair.request.body.tools && Array.isArray(pair.request.body.tools) && pair.request.body.tools.length > 0;
}
