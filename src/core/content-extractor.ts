/**
 * Pure functions for extracting content from Claude API messages
 */

import type { Message, RequestBody } from "../types/request.js";

/**
 * Extract user message text from a message object
 * Handles both string and array content formats
 * @param message - Message object from Claude API
 * @returns Extracted text content
 */
export function extractUserMessage(message: Message | undefined): string {
	if (!message) return "";

	const content = message.content;

	// Handle string format
	if (typeof content === "string") {
		return content;
	}

	// Handle array format
	if (Array.isArray(content)) {
		return content
			.filter((item) => item.type === "text")
			.map((item) => item.text || "")
			.join("\n");
	}

	return "";
}

/**
 * Extract system prompt from request body
 * @param body - Request body containing system blocks
 * @returns Combined system prompt text
 */
export function extractSystemPrompt(body: RequestBody): string {
	return (body.system || [])
		.filter((s) => s.type === "text")
		.map((s) => s.text)
		.join("\n");
}

/**
 * Find and extract the first user message from a list of messages
 * @param messages - Array of message objects
 * @returns Extracted user message text
 */
export function findAndExtractUserMessage(messages: Message[]): string {
	const userMessage = messages.find((msg) => msg.role === "user");
	return extractUserMessage(userMessage);
}
