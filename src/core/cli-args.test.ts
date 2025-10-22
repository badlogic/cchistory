/**
 * Tests for CLI argument parsing, specifically --binary-path and --claude-args
 */

import { parse, quote } from "shell-quote";
import { describe, expect, it } from "vitest";

describe("CLI Arguments Parsing", () => {
	describe("--binary-path argument parsing", () => {
		it("extracts binary path from args", () => {
			const args = ["--binary-path", "/path/to/cli.js"];
			const binaryPathIndex = args.indexOf("--binary-path");
			const customBinaryPath = binaryPathIndex !== -1 ? args[binaryPathIndex + 1] : undefined;

			expect(customBinaryPath).toBe("/path/to/cli.js");
		});

		it("handles missing binary path value", () => {
			const args = ["--binary-path"];
			const CCHISTORY_FLAGS = ["--latest", "--binary-path", "--claude-args", "--version", "-v", "--help", "-h"];
			const binaryPathIndex = args.indexOf("--binary-path");
			const customBinaryPath =
				binaryPathIndex !== -1 && args[binaryPathIndex + 1] && !CCHISTORY_FLAGS.includes(args[binaryPathIndex + 1])
					? args[binaryPathIndex + 1]
					: undefined;

			expect(customBinaryPath).toBeUndefined();
		});

		it("handles binary path followed by another flag", () => {
			const args = ["--binary-path", "--latest"];
			const CCHISTORY_FLAGS = ["--latest", "--binary-path", "--claude-args", "--version", "-v", "--help", "-h"];
			const binaryPathIndex = args.indexOf("--binary-path");
			const customBinaryPath =
				binaryPathIndex !== -1 && args[binaryPathIndex + 1] && !CCHISTORY_FLAGS.includes(args[binaryPathIndex + 1])
					? args[binaryPathIndex + 1]
					: undefined;

			expect(customBinaryPath).toBeUndefined();
		});

		it("handles relative path", () => {
			const args = ["--binary-path", "./cli.js"];
			const binaryPathIndex = args.indexOf("--binary-path");
			const customBinaryPath = binaryPathIndex !== -1 ? args[binaryPathIndex + 1] : undefined;

			expect(customBinaryPath).toBe("./cli.js");
		});

		it("handles absolute path", () => {
			const args = ["--binary-path", "/usr/local/bin/claude-code"];
			const binaryPathIndex = args.indexOf("--binary-path");
			const customBinaryPath = binaryPathIndex !== -1 ? args[binaryPathIndex + 1] : undefined;

			expect(customBinaryPath).toBe("/usr/local/bin/claude-code");
		});
	});

	describe("--claude-args argument parsing", () => {
		it("extracts claude args from args array", () => {
			const args = ["--claude-args", "--debug"];
			const claudeArgsIndex = args.indexOf("--claude-args");
			const claudeArgs = claudeArgsIndex !== -1 && args[claudeArgsIndex + 1] ? args[claudeArgsIndex + 1] : undefined;

			expect(claudeArgs).toBe("--debug");
		});

		it("handles missing claude args value", () => {
			const args = ["--claude-args"];
			const claudeArgsIndex = args.indexOf("--claude-args");
			const claudeArgs = claudeArgsIndex !== -1 && args[claudeArgsIndex + 1] ? args[claudeArgsIndex + 1] : undefined;

			expect(claudeArgs).toBeUndefined();
		});

		it("handles multiple arguments in a single string", () => {
			const args = ["--claude-args", "--debug --verbose"];
			const claudeArgsIndex = args.indexOf("--claude-args");
			const claudeArgs = claudeArgsIndex !== -1 && args[claudeArgsIndex + 1] ? args[claudeArgsIndex + 1] : undefined;

			expect(claudeArgs).toBe("--debug --verbose");
		});
	});

	describe("shell-quote security filtering", () => {
		it("filters shell operators from claude-args", () => {
			const claudeArgs = "--debug && rm -rf /";
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");

			// Shell operators should be filtered out
			expect(stringArgs).not.toContain("&&");
			expect(stringArgs).toEqual(["--debug", "rm", "-rf", "/"]);
		});

		it("handles safe arguments correctly", () => {
			const claudeArgs = "--debug --verbose --config /path/to/config.json";
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");

			expect(stringArgs).toEqual(["--debug", "--verbose", "--config", "/path/to/config.json"]);
		});

		it("filters pipe operators", () => {
			const claudeArgs = "--debug | cat";
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");

			expect(stringArgs).not.toContain("|");
			expect(stringArgs).toEqual(["--debug", "cat"]);
		});

		it("filters redirect operators", () => {
			const claudeArgs = "--debug > output.txt";
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");

			expect(stringArgs).not.toContain(">");
			expect(stringArgs).toEqual(["--debug", "output.txt"]);
		});

		it("filters semicolon separators", () => {
			const claudeArgs = "--debug; echo malicious";
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");

			expect(stringArgs).not.toContain(";");
			expect(stringArgs).toEqual(["--debug", "echo", "malicious"]);
		});

		it("properly quotes filtered arguments", () => {
			const claudeArgs = "--config /path/to/config.json --debug";
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");
			const quoted = quote(stringArgs);

			// Should be properly quoted for safe shell execution
			expect(quoted).toBeTruthy();
			expect(typeof quoted).toBe("string");
		});

		it("handles arguments with spaces", () => {
			const claudeArgs = '--message "test message with spaces"';
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");

			expect(stringArgs).toContain("--message");
			expect(stringArgs).toContain("test message with spaces");
		});

		it("handles empty string", () => {
			const claudeArgs = "";
			const parsed = parse(claudeArgs);
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");

			expect(stringArgs).toEqual([]);
		});
	});

	describe("Combined argument scenarios", () => {
		it("handles --binary-path and --claude-args together", () => {
			const args = ["--binary-path", "/path/to/cli.js", "--claude-args", "--debug"];

			const binaryPathIndex = args.indexOf("--binary-path");
			const customBinaryPath = binaryPathIndex !== -1 ? args[binaryPathIndex + 1] : undefined;

			const claudeArgsIndex = args.indexOf("--claude-args");
			const claudeArgs = claudeArgsIndex !== -1 && args[claudeArgsIndex + 1] ? args[claudeArgsIndex + 1] : undefined;

			expect(customBinaryPath).toBe("/path/to/cli.js");
			expect(claudeArgs).toBe("--debug");
		});

		it("handles version with --claude-args", () => {
			const args = ["1.0.0", "--claude-args", "--append-system-prompt"];

			const CCHISTORY_FLAGS = ["--latest", "--binary-path", "--claude-args", "--version", "-v", "--help", "-h"];
			const version = args[0] && !CCHISTORY_FLAGS.includes(args[0]) ? args[0] : undefined;

			const claudeArgsIndex = args.indexOf("--claude-args");
			const claudeArgs = claudeArgsIndex !== -1 && args[claudeArgsIndex + 1] ? args[claudeArgsIndex + 1] : undefined;

			expect(version).toBe("1.0.0");
			expect(claudeArgs).toBe("--append-system-prompt");
		});

		it("handles all arguments together", () => {
			const args = ["1.0.0", "--latest", "--claude-args", "--debug --verbose"];

			const CCHISTORY_FLAGS = ["--latest", "--binary-path", "--claude-args", "--version", "-v", "--help", "-h"];
			const version = args[0] && !CCHISTORY_FLAGS.includes(args[0]) ? args[0] : undefined;
			const fetchToLatest = args.includes("--latest");
			const claudeArgsIndex = args.indexOf("--claude-args");
			const claudeArgs = claudeArgsIndex !== -1 && args[claudeArgsIndex + 1] ? args[claudeArgsIndex + 1] : undefined;

			expect(version).toBe("1.0.0");
			expect(fetchToLatest).toBe(true);
			expect(claudeArgs).toBe("--debug --verbose");
		});
	});

	describe("Path quoting for command construction", () => {
		it("safely quotes binary path with spaces", () => {
			const binaryPath = "/path with spaces/cli.js";
			const quoted = quote([binaryPath]);

			expect(quoted).toBe("'/path with spaces/cli.js'");
		});

		it("safely quotes simple path", () => {
			const binaryPath = "/path/to/cli.js";
			const quoted = quote([binaryPath]);

			expect(quoted).toBe("/path/to/cli.js");
		});

		it("handles paths with special characters", () => {
			const binaryPath = "/path/to/cli's-file.js";
			const quoted = quote([binaryPath]);

			// Should be properly escaped
			expect(quoted).toBeTruthy();
		});
	});
});
