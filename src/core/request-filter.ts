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
 * Filter requests that have a system prompt defined
 * @param pairs - Array of request/response pairs
 * @returns Pairs with system prompts
 */
export function filterRequestsWithSystemPrompt(pairs: RequestResponsePair[]): RequestResponsePair[] {
	return pairs.filter(
		(pair) =>
			pair.request?.body?.system && Array.isArray(pair.request.body.system) && pair.request.body.system.length > 0,
	);
}

/**
 * Select the best request from candidates
 * Implements 3-tier prioritization:
 * 1. Requests with both tools AND system prompt (sorted by tool count descending)
 * 2. Requests with tools only (sorted by tool count descending)
 * 3. Any non-Haiku request (final fallback)
 * @param pairs - Array of request/response pairs
 * @returns The best request
 * @throws Error if no suitable request is found
 */
export function selectBestRequest(pairs: RequestResponsePair[]): RequestResponsePair {
	const nonHaikuPairs = filterNonHaikuRequests(pairs);
	const requestsWithTools = filterRequestsWithTools(nonHaikuPairs);

	if (requestsWithTools.length > 0) {
		// TIER 1: Prefer requests with both tools AND system prompt
		const requestsWithSystemPrompt = filterRequestsWithSystemPrompt(requestsWithTools);

		if (requestsWithSystemPrompt.length > 0) {
			return requestsWithSystemPrompt.sort(
				(a, b) => (b.request.body.tools?.length || 0) - (a.request.body.tools?.length || 0),
			)[0];
		}

		// TIER 2: Fallback to requests with tools only
		return requestsWithTools.sort(
			(a, b) => (b.request.body.tools?.length || 0) - (a.request.body.tools?.length || 0),
		)[0];
	}

	// TIER 3: Final fallback to any non-Haiku request
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
 * Check if request has tools
 * @param pair - Request/response pair
 * @returns True if request has tools
 */
export function hasTools(pair: RequestResponsePair): boolean {
	return !!pair.request.body.tools && Array.isArray(pair.request.body.tools) && pair.request.body.tools.length > 0;
}

/**
 * Check if request has a system prompt
 * @param pair - Request/response pair
 * @returns True if request has system prompt
 */
export function hasSystemPrompt(pair: RequestResponsePair): boolean {
	return (
		!!pair.request?.body?.system && Array.isArray(pair.request.body.system) && pair.request.body.system.length > 0
	);
}
