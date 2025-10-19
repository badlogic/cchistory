import { describe, expect, it } from "vitest";
import type { Tool } from "../types/request.js";
import { formatOutput, formatTools, indentHeaders } from "./output-formatter.js";

describe("output-formatter", () => {
	describe("indentHeaders", () => {
		it("adds # to single-level header", () => {
			expect(indentHeaders("# Header")).toBe("## Header");
		});

		it("adds # to multi-level headers", () => {
			const input = "# H1\n## H2\n### H3";
			const expected = "## H1\n### H2\n#### H3";
			expect(indentHeaders(input)).toBe(expected);
		});

		it("preserves non-header lines", () => {
			const input = "# Header\nRegular text\n## Subheader";
			const expected = "## Header\nRegular text\n### Subheader";
			expect(indentHeaders(input)).toBe(expected);
		});

		it("requires space after #", () => {
			expect(indentHeaders("#NoSpace")).toBe("#NoSpace");
			expect(indentHeaders("# Space")).toBe("## Space");
		});

		it("handles empty string", () => {
			expect(indentHeaders("")).toBe("");
		});

		it("handles headers with extra spaces", () => {
			expect(indentHeaders("##  Header")).toBe("###  Header");
		});
	});

	describe("formatTools", () => {
		it("formats single tool", () => {
			const tools: Tool[] = [
				{
					name: "test_tool",
					description: "A test tool",
					input_schema: { type: "object", properties: {} },
				},
			];

			const result = formatTools(tools);
			expect(result).toContain("## test_tool");
			expect(result).toContain("A test tool");
			expect(result).toContain('"type": "object"');
		});

		it("formats multiple tools with separator", () => {
			const tools: Tool[] = [
				{
					name: "tool1",
					description: "First",
					input_schema: { type: "object" },
				},
				{
					name: "tool2",
					description: "Second",
					input_schema: { type: "object" },
				},
			];

			const result = formatTools(tools);
			expect(result).toContain("## tool1");
			expect(result).toContain("## tool2");
			expect(result).toContain("\n\n---\n\n");
		});

		it("indents headers in tool descriptions twice", () => {
			const tools: Tool[] = [
				{
					name: "test_tool",
					description: "# Description\n## Details",
					input_schema: { type: "object" },
				},
			];

			const result = formatTools(tools);
			// Headers should be indented twice: # -> ## -> ###, ## -> ### -> ####
			expect(result).toContain("### Description");
			expect(result).toContain("#### Details");
		});

		it("formats empty tools array", () => {
			const result = formatTools([]);
			expect(result).toBe("");
		});

		it("formats schema with proper indentation", () => {
			const tools: Tool[] = [
				{
					name: "test_tool",
					description: "Test",
					input_schema: {
						type: "object",
						properties: {
							field: { type: "string" },
						},
					},
				},
			];

			const result = formatTools(tools);
			expect(result).toContain('  "type": "object"');
			expect(result).toContain('  "properties"');
		});
	});

	describe("formatOutput", () => {
		it("formats complete output document", () => {
			const data = {
				versionLabel: "1.0.0",
				releaseDate: "2024-01-01",
				userMessage: "Test message",
				systemPrompt: "You are Claude",
				tools: [
					{
						name: "tool1",
						description: "A tool",
						input_schema: { type: "object" },
					},
				],
			};

			const result = formatOutput(data);

			expect(result).toContain("# Claude Code Version 1.0.0");
			expect(result).toContain("Release Date: 2024-01-01");
			expect(result).toContain("# User Message");
			expect(result).toContain("Test message");
			expect(result).toContain("# System Prompt");
			expect(result).toContain("You are Claude");
			expect(result).toContain("# Tools");
			expect(result).toContain("## tool1");
		});

		it("indents user message headers", () => {
			const data = {
				versionLabel: "1.0.0",
				releaseDate: "2024-01-01",
				userMessage: "# User Header\nContent",
				systemPrompt: "System",
				tools: [],
			};

			const result = formatOutput(data);
			expect(result).toContain("## User Header");
		});

		it("indents system prompt headers", () => {
			const data = {
				versionLabel: "1.0.0",
				releaseDate: "2024-01-01",
				userMessage: "User",
				systemPrompt: "# System Header\nContent",
				tools: [],
			};

			const result = formatOutput(data);
			expect(result).toContain("## System Header");
		});

		it("handles empty tools array", () => {
			const data = {
				versionLabel: "1.0.0",
				releaseDate: "2024-01-01",
				userMessage: "Test",
				systemPrompt: "System",
				tools: [],
			};

			const result = formatOutput(data);
			expect(result).toContain("# Tools");
			// Should have tools section but empty content
			expect(result.split("# Tools")[1].trim()).toBe("");
		});

		it("formats custom binary label", () => {
			const data = {
				versionLabel: "Custom Binary (prompts-custom-2024.md)",
				releaseDate: "Custom Binary",
				userMessage: "Test",
				systemPrompt: "System",
				tools: [],
			};

			const result = formatOutput(data);
			expect(result).toContain("# Claude Code Version Custom Binary (prompts-custom-2024.md)");
			expect(result).toContain("Release Date: Custom Binary");
		});

		it("includes proper spacing between sections", () => {
			const data = {
				versionLabel: "1.0.0",
				releaseDate: "2024-01-01",
				userMessage: "User",
				systemPrompt: "System",
				tools: [],
			};

			const result = formatOutput(data);

			// Check for blank lines between sections
			expect(result).toContain("Release Date: 2024-01-01\n\n# User Message");
			expect(result).toContain("User\n\n# System Prompt");
			expect(result).toContain("System\n\n# Tools");
		});
	});
});
