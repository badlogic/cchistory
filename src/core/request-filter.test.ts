import { describe, expect, it } from "vitest";
import type { RequestResponsePair, Tool } from "../types/request.js";
import {
	filterAndSortTools,
	filterNonHaikuRequests,
	filterRequestsWithTools,
	hasTools,
	selectBestRequest,
} from "./request-filter.js";

describe("request-filter", () => {
	describe("filterNonHaikuRequests", () => {
		it("filters out haiku models", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-3-haiku-20240307", messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-3-5-sonnet-20241022", messages: [] },
					},
					response: {},
				},
			];

			const result = filterNonHaikuRequests(pairs);
			expect(result).toHaveLength(1);
			expect(result[0].request.body.model).toBe("claude-3-5-sonnet-20241022");
		});

		it("handles case-insensitive haiku detection", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-HAIKU-test", messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-sonnet", messages: [] },
					},
					response: {},
				},
			];

			const result = filterNonHaikuRequests(pairs);
			expect(result).toHaveLength(1);
			expect(result[0].request.body.model).toBe("claude-sonnet");
		});

		it("returns all non-haiku models", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-sonnet-1", messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-sonnet-2", messages: [] },
					},
					response: {},
				},
			];

			const result = filterNonHaikuRequests(pairs);
			expect(result).toHaveLength(2);
		});
	});

	describe("filterRequestsWithTools", () => {
		it("filters requests with tools", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude", messages: [], tools: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: {
							model: "claude",
							messages: [],
							tools: [
								{
									name: "tool1",
									description: "desc",
									input_schema: { type: "object" },
								},
							],
						},
					},
					response: {},
				},
			];

			const result = filterRequestsWithTools(pairs);
			expect(result).toHaveLength(1);
			expect(result[0].request.body.tools).toHaveLength(1);
		});

		it("excludes requests with empty tools array", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude", messages: [], tools: [] },
					},
					response: {},
				},
			];

			const result = filterRequestsWithTools(pairs);
			expect(result).toHaveLength(0);
		});

		it("excludes requests without tools property", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude", messages: [] },
					},
					response: {},
				},
			];

			const result = filterRequestsWithTools(pairs);
			expect(result).toHaveLength(0);
		});
	});

	describe("selectBestRequest", () => {
		it("selects request with most tools", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: {
							model: "claude-sonnet",
							messages: [],
							tools: [
								{
									name: "tool1",
									description: "desc",
									input_schema: { type: "object" },
								},
							],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: {
							model: "claude-sonnet",
							messages: [],
							tools: [
								{
									name: "tool1",
									description: "desc",
									input_schema: { type: "object" },
								},
								{
									name: "tool2",
									description: "desc",
									input_schema: { type: "object" },
								},
							],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			expect(result.request.body.tools).toHaveLength(2);
		});

		it("falls back to non-haiku request when no tools found", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-haiku", messages: [] },
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-sonnet", messages: [] },
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			expect(result.request.body.model).toBe("claude-sonnet");
		});

		it("throws error when no non-haiku request found", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: { model: "claude-haiku", messages: [] },
					},
					response: {},
				},
			];

			expect(() => selectBestRequest(pairs)).toThrow("No non-Haiku request found in the log");
		});

		it("filters out haiku before selecting best", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: {
							model: "claude-haiku",
							messages: [],
							tools: [
								{
									name: "tool1",
									description: "desc",
									input_schema: { type: "object" },
								},
								{
									name: "tool2",
									description: "desc",
									input_schema: { type: "object" },
								},
								{
									name: "tool3",
									description: "desc",
									input_schema: { type: "object" },
								},
							],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: {
							model: "claude-sonnet",
							messages: [],
							tools: [
								{
									name: "tool1",
									description: "desc",
									input_schema: { type: "object" },
								},
							],
						},
					},
					response: {},
				},
			];

			const result = selectBestRequest(pairs);
			// Should select sonnet even though haiku has more tools
			expect(result.request.body.model).toBe("claude-sonnet");
		});

		it("handles requests with undefined tools in sorting", () => {
			const pairs: RequestResponsePair[] = [
				{
					request: {
						timestamp: 1,
						method: "POST",
						url: "/",
						headers: {},
						body: {
							model: "claude-sonnet",
							messages: [],
							tools: [
								{
									name: "tool1",
									description: "desc",
									input_schema: { type: "object" },
								},
							],
						},
					},
					response: {},
				},
				{
					request: {
						timestamp: 2,
						method: "POST",
						url: "/",
						headers: {},
						body: {
							model: "claude-sonnet",
							messages: [],
							// tools property exists but is undefined (edge case)
							tools: undefined,
						} as any,
					},
					response: {},
				},
			];

			// Should handle undefined tools gracefully during sort
			const result = selectBestRequest(pairs);
			expect(result.request.body.tools).toHaveLength(1);
		});
	});

	describe("filterAndSortTools", () => {
		it("filters out mcp__ tools", () => {
			const tools: Tool[] = [
				{
					name: "mcp__tool1",
					description: "desc",
					input_schema: { type: "object" },
				},
				{
					name: "regular_tool",
					description: "desc",
					input_schema: { type: "object" },
				},
				{
					name: "mcp__tool2",
					description: "desc",
					input_schema: { type: "object" },
				},
			];

			const result = filterAndSortTools(tools);
			expect(result).toHaveLength(1);
			expect(result[0].name).toBe("regular_tool");
		});

		it("sorts tools alphabetically by name", () => {
			const tools: Tool[] = [
				{
					name: "zebra",
					description: "desc",
					input_schema: { type: "object" },
				},
				{
					name: "alpha",
					description: "desc",
					input_schema: { type: "object" },
				},
				{
					name: "beta",
					description: "desc",
					input_schema: { type: "object" },
				},
			];

			const result = filterAndSortTools(tools);
			expect(result.map((t) => t.name)).toEqual(["alpha", "beta", "zebra"]);
		});

		it("returns empty array for undefined tools", () => {
			const result = filterAndSortTools(undefined);
			expect(result).toEqual([]);
		});

		it("returns empty array for empty tools array", () => {
			const result = filterAndSortTools([]);
			expect(result).toEqual([]);
		});
	});

	describe("hasTools", () => {
		it("returns true when request has tools", () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: "POST",
					url: "/",
					headers: {},
					body: {
						model: "claude",
						messages: [],
						tools: [
							{
								name: "tool1",
								description: "desc",
								input_schema: { type: "object" },
							},
						],
					},
				},
				response: {},
			};

			expect(hasTools(pair)).toBe(true);
		});

		it("returns false when tools array is empty", () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: "POST",
					url: "/",
					headers: {},
					body: { model: "claude", messages: [], tools: [] },
				},
				response: {},
			};

			expect(hasTools(pair)).toBe(false);
		});

		it("returns false when tools is undefined", () => {
			const pair: RequestResponsePair = {
				request: {
					timestamp: 1,
					method: "POST",
					url: "/",
					headers: {},
					body: { model: "claude", messages: [] },
				},
				response: {},
			};

			expect(hasTools(pair)).toBe(false);
		});
	});
});
