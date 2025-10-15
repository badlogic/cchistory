/**
 * Pure parser for JSONL (JSON Lines) format
 */

import type { RequestResponsePair } from "../types/request.js";

/**
 * Parse JSONL content into structured request/response pairs
 * @param content - JSONL string where each line is a separate JSON object
 * @returns Array of parsed request/response pairs
 */
export function parseJsonl(content: string): RequestResponsePair[] {
	return content
		.trim()
		.split("\n")
		.filter((line) => line.trim())
		.map((line) => JSON.parse(line) as RequestResponsePair);
}
