import { describe, expect, it } from "vitest";
import type { Message, RequestBody } from "../types/request.js";
import { extractSystemPrompt, extractUserMessage, findAndExtractUserMessage } from "./content-extractor.js";

describe("content-extractor", () => {
	describe("extractUserMessage", () => {
		it("extracts text from string content", () => {
			const message: Message = {
				role: "user",
				content: "Hello world",
			};
			expect(extractUserMessage(message)).toBe("Hello world");
		});

		it("extracts text from array content with single text block", () => {
			const message: Message = {
				role: "user",
				content: [{ type: "text", text: "Hello world" }],
			};
			expect(extractUserMessage(message)).toBe("Hello world");
		});

		it("extracts text from array content with multiple text blocks", () => {
			const message: Message = {
				role: "user",
				content: [
					{ type: "text", text: "Hello" },
					{ type: "text", text: "World" },
				],
			};
			expect(extractUserMessage(message)).toBe("Hello\nWorld");
		});

		it("filters out non-text content types", () => {
			const message: Message = {
				role: "user",
				content: [{ type: "text", text: "Hello" }, { type: "image" }, { type: "text", text: "World" }],
			};
			expect(extractUserMessage(message)).toBe("Hello\nWorld");
		});

		it("returns empty string for undefined message", () => {
			expect(extractUserMessage(undefined)).toBe("");
		});

		it("returns empty string for empty array content", () => {
			const message: Message = {
				role: "user",
				content: [],
			};
			expect(extractUserMessage(message)).toBe("");
		});

		it("handles text blocks without text property", () => {
			const message: Message = {
				role: "user",
				content: [{ type: "text" }],
			};
			expect(extractUserMessage(message)).toBe("");
		});

		it("returns empty string for invalid content type", () => {
			const message: any = {
				role: "user",
				content: 123, // number instead of string/array
			};
			expect(extractUserMessage(message)).toBe("");
		});
	});

	describe("extractSystemPrompt", () => {
		it("extracts single system prompt", () => {
			const body: RequestBody = {
				model: "claude",
				messages: [],
				system: [{ type: "text", text: "You are Claude" }],
			};
			expect(extractSystemPrompt(body)).toBe("You are Claude");
		});

		it("joins multiple system blocks", () => {
			const body: RequestBody = {
				model: "claude",
				messages: [],
				system: [
					{ type: "text", text: "You are Claude" },
					{ type: "text", text: "Be helpful" },
				],
			};
			expect(extractSystemPrompt(body)).toBe("You are Claude\nBe helpful");
		});

		it("filters out non-text system blocks", () => {
			const body: RequestBody = {
				model: "claude",
				messages: [],
				system: [
					{ type: "text", text: "You are Claude" },
					{ type: "other", text: "Ignored" },
					{ type: "text", text: "Be helpful" },
				],
			};
			expect(extractSystemPrompt(body)).toBe("You are Claude\nBe helpful");
		});

		it("returns empty string when system is undefined", () => {
			const body: RequestBody = {
				model: "claude",
				messages: [],
			};
			expect(extractSystemPrompt(body)).toBe("");
		});

		it("returns empty string when system is empty array", () => {
			const body: RequestBody = {
				model: "claude",
				messages: [],
				system: [],
			};
			expect(extractSystemPrompt(body)).toBe("");
		});
	});

	describe("findAndExtractUserMessage", () => {
		it("finds and extracts first user message", () => {
			const messages: Message[] = [
				{ role: "system", content: "System message" },
				{ role: "user", content: "User message" },
				{ role: "assistant", content: "Assistant message" },
			];
			expect(findAndExtractUserMessage(messages)).toBe("User message");
		});

		it("returns empty string when no user message found", () => {
			const messages: Message[] = [
				{ role: "system", content: "System message" },
				{ role: "assistant", content: "Assistant message" },
			];
			expect(findAndExtractUserMessage(messages)).toBe("");
		});

		it("handles array content in user message", () => {
			const messages: Message[] = [
				{
					role: "user",
					content: [
						{ type: "text", text: "Hello" },
						{ type: "text", text: "World" },
					],
				},
			];
			expect(findAndExtractUserMessage(messages)).toBe("Hello\nWorld");
		});

		it("returns first user message when multiple exist", () => {
			const messages: Message[] = [
				{ role: "user", content: "First user" },
				{ role: "assistant", content: "Response" },
				{ role: "user", content: "Second user" },
			];
			expect(findAndExtractUserMessage(messages)).toBe("First user");
		});
	});
});
