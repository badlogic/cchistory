/**
 * Tests for command construction with various argument combinations
 * Verifies that commands are properly constructed according to README examples
 */

import { parse, quote } from "shell-quote";
import { describe, expect, it } from "vitest";

describe("Command Construction", () => {
	/**
	 * Helper function that simulates the command construction logic from index.ts
	 */
	function constructCommand(customBinaryPath: string | undefined, claudeArgs: string | undefined): string {
		const claudePathArg = customBinaryPath ? quote([customBinaryPath]) : "./package/cli.js";
		let additionalArgs = "";
		if (claudeArgs) {
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");
			additionalArgs = quote(stringArgs);
		}
		const command = `npx --node-options="--no-warnings" -y @mariozechner/claude-trace --claude-path ${claudePathArg} --no-open --run-with ${additionalArgs}${
			additionalArgs ? " " : ""
		}-p "${new Date().toISOString()} is the date. Write a haiku about it."`;
		return command;
	}

	describe("README Example 1: Extract from single version", () => {
		it("constructs command for npm package without custom args", () => {
			const command = constructCommand(undefined, undefined);

			expect(command).toContain("@mariozechner/claude-trace");
			expect(command).toContain("--claude-path ./package/cli.js");
			expect(command).toContain("--no-open");
			expect(command).toContain("--run-with");
			expect(command).toContain('-p "');
			expect(command).toContain("Write a haiku about it");
		});
	});

	describe("README Example 3: Test custom/local build", () => {
		it("constructs command with custom binary path", () => {
			const command = constructCommand("/path/to/custom/cli.js", undefined);

			expect(command).toContain("--claude-path /path/to/custom/cli.js");
			expect(command).not.toContain("./package/cli.js");
		});

		it("properly quotes binary path with spaces", () => {
			const command = constructCommand("/path with spaces/cli.js", undefined);

			expect(command).toContain("--claude-path '/path with spaces/cli.js'");
		});

		it("handles relative path", () => {
			const command = constructCommand("./build/cli.js", undefined);

			expect(command).toContain("--claude-path ./build/cli.js");
		});
	});

	describe("README Example 4: Test with additional arguments", () => {
		it("constructs command with claude args for npm version", () => {
			const command = constructCommand(undefined, "--mcp-config /path/to/config.json");

			expect(command).toContain("--run-with --mcp-config /path/to/config.json -p");
		});

		it("handles multiple claude args", () => {
			const command = constructCommand(undefined, "--debug --verbose");

			expect(command).toContain("--run-with --debug --verbose -p");
		});
	});

	describe("README Example 5: Combine custom binary with custom arguments", () => {
		it("constructs command with both custom binary and args", () => {
			const command = constructCommand("./build/cli.js", "--verbose");

			expect(command).toContain("--claude-path ./build/cli.js");
			expect(command).toContain("--run-with --verbose -p");
		});

		it("handles complex combination", () => {
			const command = constructCommand("/custom/path/cli.js", "--debug --config test.json");

			expect(command).toContain("--claude-path /custom/path/cli.js");
			expect(command).toContain("--run-with --debug --config test.json -p");
		});
	});

	describe("README Example 6: Pass system prompt modifiers", () => {
		it("constructs command with system prompt modifier", () => {
			const command = constructCommand(undefined, "--append-system-prompt");

			expect(command).toContain("--run-with --append-system-prompt -p");
		});
	});

	describe("Security: Shell injection prevention", () => {
		it("filters shell operators from claude args", () => {
			const command = constructCommand(undefined, "--debug && rm -rf /");

			// The command should not contain '&&' as a shell operator
			// It will be filtered by parse() and the args will be quoted
			expect(command).toContain("--run-with");
			// The filtered result should only contain safe arguments
			expect(command).not.toContain("&& ");
		});

		it("filters pipe operators", () => {
			const command = constructCommand(undefined, "--debug | cat /etc/passwd");

			// Should not contain pipe as a shell operator
			expect(command).not.toContain("| ");
		});

		it("filters redirect operators", () => {
			const command = constructCommand(undefined, "--debug > malicious.txt");

			// Should not contain redirect as a shell operator
			expect(command).not.toContain("> ");
		});

		it("filters semicolon separators", () => {
			const command = constructCommand(undefined, "--debug; echo malicious");

			// Should not contain semicolon as a shell operator
			expect(command).not.toContain("; ");
		});

		it("safely handles binary path with special characters", () => {
			const command = constructCommand("/path/with/special's/cli.js", undefined);

			// Path should be properly quoted
			expect(command).toContain("--claude-path");
			// Should not break the command structure
			expect(command).toContain("@mariozechner/claude-trace");
		});
	});

	describe("Edge cases", () => {
		it("handles empty claude args", () => {
			const command = constructCommand(undefined, "");

			// Should work fine with empty string (note: single space between --run-with and -p)
			expect(command).toContain("--run-with -p");
			expect(command).toContain("@mariozechner/claude-trace");
		});

		it("handles single argument", () => {
			const command = constructCommand(undefined, "--debug");

			expect(command).toContain("--run-with --debug -p");
		});

		it("handles arguments with equals sign", () => {
			const command = constructCommand(undefined, "--config=test.json");

			// shell-quote escapes the equals sign for safety
			expect(command).toContain("--run-with");
			expect(command).toContain("--config");
			expect(command).toContain("test.json");
		});

		it("preserves quoted arguments in claude args", () => {
			const command = constructCommand(undefined, '--message "hello world"');

			expect(command).toContain("--run-with");
			// The quoted content should be preserved through parse/quote
			expect(command).toContain("hello world");
		});
	});

	describe("Command structure validation", () => {
		it("always includes required npx flags", () => {
			const command = constructCommand(undefined, undefined);

			expect(command).toMatch(/^npx --node-options="--no-warnings" -y/);
		});

		it("always includes claude-trace package", () => {
			const command = constructCommand(undefined, undefined);

			expect(command).toContain("@mariozechner/claude-trace");
		});

		it("always includes --no-open flag", () => {
			const command = constructCommand(undefined, undefined);

			expect(command).toContain("--no-open");
		});

		it("always includes --run-with flag", () => {
			const command = constructCommand(undefined, undefined);

			expect(command).toContain("--run-with");
		});

		it("always includes the test prompt", () => {
			const command = constructCommand(undefined, undefined);

			expect(command).toContain("Write a haiku about it");
		});

		it("maintains proper argument order", () => {
			const command = constructCommand("/path/cli.js", "--debug");

			// Verify the order: npx ... claude-trace --claude-path ... --no-open --run-with ... -p "..."
			expect(command).toMatch(/npx.*claude-trace.*--claude-path.*--no-open.*--run-with.*-p.*Write a haiku about it/);
		});
	});
});
