/**
 * Pure functions for formatting output markdown
 */

import type { Tool } from "../types/request.js";

export interface OutputData {
	versionLabel: string;
	releaseDate: string;
	userMessage: string;
	systemPrompt: string;
	tools: Tool[];
}

/**
 * Add an extra # to all markdown headers in text
 * This indents headers by one level (e.g., # becomes ##)
 * @param text - Text containing markdown headers
 * @returns Text with indented headers
 */
export function indentHeaders(text: string): string {
	return text
		.split("\n")
		.map((line) => {
			const match = line.match(/^(#+)(\s+)/);
			if (match) {
				return `#${line}`;
			}
			return line;
		})
		.join("\n");
}

/**
 * Format tools as markdown sections
 * @param tools - Array of tools to format
 * @returns Formatted markdown string
 */
export function formatTools(tools: Tool[]): string {
	return tools
		.map((tool) => {
			const schemaStr = JSON.stringify(tool.input_schema, null, 2);
			// Apply indentation twice to make headers in tool descriptions smaller
			const indentedDescription = indentHeaders(indentHeaders(tool.description));
			return `## ${tool.name}\n\n${indentedDescription}\n${schemaStr}`;
		})
		.join("\n\n---\n\n");
}

/**
 * Format complete output document
 * @param data - Output data structure
 * @returns Complete formatted markdown document
 */
export function formatOutput(data: OutputData): string {
	const toolsSection = formatTools(data.tools);

	return `# Claude Code Version ${data.versionLabel}

Release Date: ${data.releaseDate}

# User Message

${indentHeaders(data.userMessage)}

# System Prompt

${indentHeaders(data.systemPrompt)}

# Tools

${toolsSection}
`;
}
