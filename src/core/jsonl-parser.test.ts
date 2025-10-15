import { describe, expect, it } from "vitest";
import { parseJsonl } from "./jsonl-parser.js";

describe("jsonl-parser", () => {
	describe("parseJsonl", () => {
		it("parses single line JSONL", () => {
			const jsonl = '{"request":{"body":{"model":"claude"}},"response":{}}';
			const result = parseJsonl(jsonl);

			expect(result).toHaveLength(1);
			expect(result[0].request.body.model).toBe("claude");
		});

		it("parses multiple lines JSONL", () => {
			const jsonl = `{"request":{"body":{"model":"claude-1"}},"response":{}}
{"request":{"body":{"model":"claude-2"}},"response":{}}
{"request":{"body":{"model":"claude-3"}},"response":{}}`;
			const result = parseJsonl(jsonl);

			expect(result).toHaveLength(3);
			expect(result[0].request.body.model).toBe("claude-1");
			expect(result[1].request.body.model).toBe("claude-2");
			expect(result[2].request.body.model).toBe("claude-3");
		});

		it("filters out empty lines", () => {
			const jsonl = `{"request":{"body":{"model":"claude-1"}},"response":{}}

{"request":{"body":{"model":"claude-2"}},"response":{}}

`;
			const result = parseJsonl(jsonl);

			expect(result).toHaveLength(2);
			expect(result[0].request.body.model).toBe("claude-1");
			expect(result[1].request.body.model).toBe("claude-2");
		});

		it("handles trailing newline", () => {
			const jsonl = '{"request":{"body":{"model":"claude"}},"response":{}}\n';
			const result = parseJsonl(jsonl);

			expect(result).toHaveLength(1);
			expect(result[0].request.body.model).toBe("claude");
		});

		it("handles leading/trailing whitespace", () => {
			const jsonl = '  {"request":{"body":{"model":"claude"}},"response":{}}  \n';
			const result = parseJsonl(jsonl);

			expect(result).toHaveLength(1);
			expect(result[0].request.body.model).toBe("claude");
		});

		it("parses complex nested objects", () => {
			const jsonl = `{"request":{"timestamp":123,"body":{"model":"claude","messages":[{"role":"user","content":"test"}],"tools":[{"name":"tool1","description":"desc"}]}},"response":{"status":"ok"}}`;
			const result = parseJsonl(jsonl);

			expect(result).toHaveLength(1);
			expect(result[0].request.timestamp).toBe(123);
			expect(result[0].request.body.messages).toHaveLength(1);
			expect(result[0].request.body.messages[0].role).toBe("user");
			expect(result[0].request.body.tools).toHaveLength(1);
			expect(result[0].response.status).toBe("ok");
		});
	});
});
