#!/usr/bin/env node

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import chalk from "chalk";
import { parse, quote } from "shell-quote";

/** cchistory's own flags - used for argument validation */
const CCHISTORY_FLAGS = ["--latest", "--binary-path", "--claude-args", "--version", "-v", "--help", "-h"];

interface CacheControl {
	type: string;
}

interface InputSchema {
	type?: string;
	properties?: Record<string, unknown>;
	required?: string[];
	[key: string]: unknown;
}

interface RequestResponsePair {
	request: {
		timestamp: number;
		method: string;
		url: string;
		headers: Record<string, string>;
		body: {
			model: string;
			messages: Array<{
				role: string;
				content:
					| string
					| Array<{
							type: string;
							text?: string;
							cache_control?: CacheControl;
					  }>;
			}>;
			temperature?: number;
			system?: Array<{
				type: string;
				text: string;
				cache_control?: CacheControl;
			}>;
			tools?: Array<{
				name: string;
				description: string;
				input_schema: InputSchema;
			}>;
		};
	};
	response: Record<string, unknown>;
}

function parseVersion(version: string): {
	major: number;
	minor: number;
	patch: number;
} {
	const parts = version.split(".");
	return {
		major: parseInt(parts[0], 10),
		minor: parseInt(parts[1], 10),
		patch: parseInt(parts[2], 10),
	};
}

function compareVersions(a: string, b: string): number {
	const va = parseVersion(a);
	const vb = parseVersion(b);

	if (va.major !== vb.major) return va.major - vb.major;
	if (va.minor !== vb.minor) return va.minor - vb.minor;
	return va.patch - vb.patch;
}

function getLatestVersion(): string {
	try {
		const output = execSync("npm view @anthropic-ai/claude-code version", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		}).trim();
		return output;
	} catch (error) {
		console.error(chalk.red("Failed to fetch latest version from npm:"));
		console.error(chalk.gray("Command: npm view @anthropic-ai/claude-code version"));
		const errorObj = error as {
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		if (errorObj.stdout) console.error(chalk.gray("stdout:"), errorObj.stdout);
		if (errorObj.stderr) console.error(chalk.gray("stderr:"), errorObj.stderr);
		console.error(chalk.gray("Error:"), error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

function getAllVersionsBetween(startVersion: string, endVersion: string): string[] {
	try {
		// Get all versions from npm
		const output = execSync("npm view @anthropic-ai/claude-code versions --json", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const allVersions: string[] = JSON.parse(output);

		// Filter versions between start and end (inclusive)
		return allVersions
			.filter((v) => {
				return compareVersions(v, startVersion) >= 0 && compareVersions(v, endVersion) <= 0;
			})
			.sort(compareVersions);
	} catch (error) {
		console.error(chalk.red("Failed to fetch version list from npm:"));
		console.error(chalk.gray("Command: npm view @anthropic-ai/claude-code versions --json"));
		const errorObj = error as {
			stdout?: string;
			stderr?: string;
			message?: string;
		};
		if (errorObj.stdout) console.error(chalk.gray("stdout:"), errorObj.stdout);
		if (errorObj.stderr) console.error(chalk.gray("stderr:"), errorObj.stderr);
		console.error(chalk.gray("Error:"), error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

function getVersionReleaseDate(version: string): string {
	try {
		const output = execSync(`npm view @anthropic-ai/claude-code@${quote([version])} time --json`, {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const times = JSON.parse(output);
		const releaseDate = new Date(times[version]);
		return releaseDate.toISOString().split("T")[0]; // Return YYYY-MM-DD format
	} catch (_error) {
		return "Unknown";
	}
}

/**
 * Creates a temporary working directory with an empty CLAUDE.md file
 * @param prefix - Prefix for the temp directory name
 * @returns Path to the created temporary directory
 */
function createTempWorkDir(prefix: string): string {
	const tmpBaseDir = os.tmpdir();
	const tmpDirName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
	const tmpDir = path.join(tmpBaseDir, tmpDirName);
	fs.mkdirSync(tmpDir, { recursive: true });
	fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "");
	return tmpDir;
}

/**
 * Process a single Claude Code version and extract its prompts, tools, and system messages
 * @param versionOrLabel - NPM version string (e.g., "1.0.0") or custom label for output filename
 * @param originalCwd - Original working directory for output files
 * @param customBinaryPath - Optional path to a custom Claude Code binary
 * @param claudeArgs - Optional arguments to pass to Claude Code during execution
 */
async function processVersion(
	versionOrLabel: string,
	originalCwd: string,
	customBinaryPath?: string,
	claudeArgs?: string,
) {
	const outputFilename = customBinaryPath
		? `prompts-custom-${new Date().toISOString().replace(/[:.]/g, "-")}.md`
		: `prompts-${versionOrLabel}.md`;
	const outputPath = path.join(originalCwd, outputFilename);

	if (fs.existsSync(outputPath)) {
		console.log(chalk.gray(`Skipping ${customBinaryPath ? "custom binary" : versionOrLabel} - already exists`));
		return;
	}

	console.log(
		chalk.blue(`Processing ${customBinaryPath ? `custom binary (${customBinaryPath})` : versionOrLabel}...`),
	);

	// Determine CLI path and whether to use temp directory
	let cliPath: string;
	let tmpDir: string | undefined;
	let packageDir: string | undefined;

	if (customBinaryPath) {
		cliPath = customBinaryPath;
	} else {
		tmpDir = createTempWorkDir("claude-history");
		packageDir = path.join(tmpDir, "package");
		cliPath = path.join(packageDir, "cli.js");

		try {
			execSync(`npm pack @anthropic-ai/claude-code@${quote([versionOrLabel])}`, {
				cwd: tmpDir,
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (error) {
			console.error(chalk.red(`Failed to download version ${versionOrLabel} from npm:`));
			console.error(chalk.gray(`Command: npm pack @anthropic-ai/claude-code@${versionOrLabel}`));
			const errorObj = error as {
				stdout?: string;
				stderr?: string;
				message?: string;
			};
			if (errorObj.stdout) console.error(chalk.gray("stdout:"), errorObj.stdout);
			if (errorObj.stderr) console.error(chalk.gray("stderr:"), errorObj.stderr);
			console.error(chalk.gray("Error:"), error instanceof Error ? error.message : String(error));
			throw error;
		}

		const tarFile = path.join(tmpDir, `anthropic-ai-claude-code-${versionOrLabel}.tgz`);
		execSync(`tar -xzf ${quote([tarFile])}`, {
			cwd: tmpDir,
			stdio: ["pipe", "pipe", "pipe"],
		});

		if (!fs.existsSync(cliPath)) {
			console.error(chalk.red(`CLI file not found for version ${versionOrLabel}`));
			console.error(chalk.gray("Expected path:"), cliPath);
			console.error(chalk.gray("Package contents:"));
			try {
				const packageFiles = fs.readdirSync(packageDir);
				packageFiles.forEach((file) => console.error(chalk.gray(`  - ${file}`)));
			} catch (_e) {
				console.error(chalk.gray("  Could not list package directory"));
			}
			throw new Error(`CLI file not found at ${cliPath}`);
		}

		let cliContent = fs.readFileSync(cliPath, "utf-8");

		// FRAGILE: This patching relies on specific string patterns in cli.js
		// If Claude Code changes the version warning format or uses minification,
		// this may fail (acceptable - we'll see the warning in that case)
		const warningText = "It looks like your version of Claude Code";
		const warningIndex = cliContent.indexOf(warningText);

		if (warningIndex !== -1) {
			// Scan backwards from the warning to find "function"
			let functionIndex = -1;
			for (let i = warningIndex; i >= 0; i--) {
				if (cliContent.substring(i, i + 8) === "function") {
					functionIndex = i;
					break;
				}
			}

			if (functionIndex === -1) {
				throw new Error("Could not find function declaration before warning text");
			}

			// Find the opening brace
			let openBraceIndex = -1;
			for (let i = functionIndex; i < cliContent.length; i++) {
				if (cliContent[i] === "{") {
					openBraceIndex = i;
					break;
				}
			}

			if (openBraceIndex === -1) {
				throw new Error("Could not find opening brace after function declaration");
			}

			// Find the matching closing brace
			let braceCount = 1;
			let closeBraceIndex = -1;

			for (let i = openBraceIndex + 1; i < cliContent.length; i++) {
				if (cliContent[i] === "{") {
					braceCount++;
				} else if (cliContent[i] === "}") {
					braceCount--;
					if (braceCount === 0) {
						closeBraceIndex = i;
						break;
					}
				}
			}

			if (closeBraceIndex === -1) {
				throw new Error("Could not find matching closing brace");
			}

			// Extract the function
			const functionDeclaration = cliContent.substring(functionIndex, openBraceIndex + 1);

			// Replace the function body with an empty block
			const patchedFunction = `${functionDeclaration} /* Version check disabled by patch */ }`;
			cliContent =
				cliContent.substring(0, functionIndex) + patchedFunction + cliContent.substring(closeBraceIndex + 1);
		} else {
			console.error(chalk.yellow(`Warning: Could not find version check to patch in version ${versionOrLabel}`));
			console.error(chalk.gray("This version might not have the version check, continuing anyway..."));
			// Don't throw, just continue - older versions might not have this check
		}

		fs.writeFileSync(cliPath, cliContent);
	}

	try {
		// Determine working directory for claude-trace
		let workDir: string;
		if (customBinaryPath) {
			// Create a temp directory for custom binary execution
			tmpDir = createTempWorkDir("claude-history-custom");
			workDir = tmpDir;
		} else {
			if (!tmpDir) {
				throw new Error("Internal error: tmpDir not initialized for npm package");
			}
			workDir = tmpDir;
		}

		process.chdir(workDir);

		// Build the claude-trace command
		const claudePathArg = customBinaryPath ? quote([customBinaryPath]) : "./package/cli.js";
		let additionalArgs = "";
		if (claudeArgs) {
			const parsed = parse(claudeArgs);
			// Filter to only string entries for safety (reject shell operators)
			const stringArgs = parsed.filter((entry): entry is string => typeof entry === "string");
			additionalArgs = quote(stringArgs);
		}
		const command = `npx --node-options="--no-warnings" -y @mariozechner/claude-trace --claude-path ${claudePathArg} --no-open --run-with ${additionalArgs}${
			additionalArgs ? " " : ""
		}-p "${new Date().toISOString()} is the date. Write a haiku about it."`;

		try {
			execSync(command, {
				encoding: "utf-8",
				stdio: ["pipe", "pipe", "pipe"],
			});
		} catch (error) {
			console.error(
				chalk.red(
					`\nFailed to run claude-trace for ${customBinaryPath ? "custom binary" : `version ${versionOrLabel}`}:`,
				),
			);
			console.error(chalk.gray("Command:"), command);
			const errorObj = error as {
				stdout?: string;
				stderr?: string;
				status?: number;
				code?: number;
				message?: string;
			};
			if (errorObj.stdout) {
				console.error(chalk.gray("stdout:"));
				console.error(errorObj.stdout);
			}
			if (errorObj.stderr) {
				console.error(chalk.gray("stderr:"));
				console.error(errorObj.stderr);
			}
			console.error(chalk.gray("Error:"), error instanceof Error ? error.message : String(error));
			console.error(chalk.gray("Exit code:"), errorObj.status || errorObj.code || "unknown");
			throw error;
		}

		// Find the generated JSONL file
		if (!tmpDir) {
			throw new Error("Internal error: tmpDir not initialized");
		}
		const claudeTraceDir = path.join(tmpDir, ".claude-trace");
		const files = fs.readdirSync(claudeTraceDir);
		const jsonlFile = files.find((f) => f.startsWith("log-") && f.endsWith(".jsonl"));

		if (!jsonlFile) {
			throw new Error("No JSONL log file found in .claude-trace directory");
		}

		// Parse the JSONL file
		const jsonlPath = path.join(claudeTraceDir, jsonlFile);
		const jsonlContent = fs.readFileSync(jsonlPath, "utf-8");

		// JSONL format: each line is a separate JSON object
		const data: RequestResponsePair[] = jsonlContent
			.trim()
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line));

		// Debug: log all request models found
		if (process.env.DEBUG) {
			console.log(chalk.gray("\nDebug: Requests found in log:"));
			data.forEach((pair, idx) => {
				const model = pair.request?.body?.model || "unknown";
				const toolCount = pair.request?.body?.tools?.length || 0;
				console.log(chalk.gray(`  ${idx + 1}. Model: ${model}, Tools: ${toolCount}`));
			});
			console.log();
		}

		// Find requests with tools (Claude Code requests should have tools)
		const requestsWithTools = data.filter(
			(pair) =>
				pair.request?.body?.model &&
				!pair.request.body.model.toLowerCase().includes("haiku") &&
				pair.request.body.tools &&
				Array.isArray(pair.request.body.tools) &&
				pair.request.body.tools.length > 0,
		);

		let nonHaikuRequest: RequestResponsePair | undefined;

		if (requestsWithTools.length === 0) {
			// Fallback to old behavior if no requests with tools found
			nonHaikuRequest = data.find(
				(pair) => pair.request?.body?.model && !pair.request.body.model.toLowerCase().includes("haiku"),
			);

			if (!nonHaikuRequest) {
				throw new Error("No non-Haiku request found in the log");
			}

			console.warn(chalk.yellow("Warning: Selected request has no tools. This may not be a Claude Code request."));
		} else {
			// Sort by tool count (descending) to get the most complete request
			nonHaikuRequest = requestsWithTools.sort(
				(a, b) => (b.request.body.tools?.length || 0) - (a.request.body.tools?.length || 0),
			)[0];
		}

		// Extract the required information
		const request = nonHaikuRequest.request;

		// Extract user message - get all content blocks from the first user message with type safety
		const userMessageContent = request.body.messages.find((msg) => msg.role === "user")?.content;
		const userMessage = (() => {
			if (!userMessageContent) return "";

			// Handle both string and array formats
			if (typeof userMessageContent === "string") {
				return userMessageContent;
			}

			if (Array.isArray(userMessageContent)) {
				return userMessageContent
					.filter((content) => content.type === "text")
					.map((content) => content.text || "")
					.join("\n");
			}

			return "";
		})();

		// Extract system prompt - join without double newlines
		const systemPrompt = (request.body.system || [])
			.filter((s) => s.type === "text")
			.map((s) => s.text)
			.join("\n");

		// Function to add extra # to markdown headers
		const indentHeaders = (text: string): string => {
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
		};

		// Extract and sort tools, filtering out mcp__ tools
		const tools = (request.body.tools || [])
			.filter((tool) => !tool.name.startsWith("mcp__"))
			.sort((a, b) => a.name.localeCompare(b.name))
			.map((tool) => {
				const schemaStr = JSON.stringify(tool.input_schema, null, 2);
				// Apply indentation twice to make headers in tool descriptions smaller
				const indentedDescription = indentHeaders(indentHeaders(tool.description));
				return `## ${tool.name}\n\n${indentedDescription}\n${schemaStr}`;
			})
			.join("\n\n---\n\n");

		// Get release date (only for npm versions)
		const releaseDate = customBinaryPath ? "Custom Binary" : getVersionReleaseDate(versionOrLabel);
		const versionLabel = customBinaryPath ? `Custom Binary (${outputFilename})` : versionOrLabel;

		const output = `# Claude Code Version ${versionLabel}

Release Date: ${releaseDate}

# User Message

${indentHeaders(userMessage)}

# System Prompt

${indentHeaders(systemPrompt)}

# Tools

${tools}
`;

		fs.writeFileSync(outputPath, output);

		console.log(
			chalk.green(`✓ ${customBinaryPath ? "custom binary" : versionOrLabel} → ${path.basename(outputPath)}`),
		);
	} finally {
		// Change back to original directory and clean up
		process.chdir(originalCwd);
		if (tmpDir && fs.existsSync(tmpDir)) {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	}
}

/**
 * Main entry point - parses CLI arguments and orchestrates version processing
 * Handles both npm version extraction and custom binary analysis
 */
async function main() {
	const args = process.argv.slice(2);
	const fetchToLatest = args.includes("--latest");

	const binaryPathIndex = args.indexOf("--binary-path");
	const customBinaryPath =
		binaryPathIndex !== -1 && args[binaryPathIndex + 1] && !CCHISTORY_FLAGS.includes(args[binaryPathIndex + 1])
			? args[binaryPathIndex + 1]
			: undefined;

	if (binaryPathIndex !== -1 && !customBinaryPath) {
		console.error(chalk.red("Error: --binary-path requires a valid path value"));
		process.exit(1);
	}

	const claudeArgsIndex = args.indexOf("--claude-args");
	const claudeArgs = claudeArgsIndex !== -1 && args[claudeArgsIndex + 1] ? args[claudeArgsIndex + 1] : undefined;

	if (claudeArgsIndex !== -1 && !claudeArgs) {
		console.error(chalk.red("Error: --claude-args requires a value"));
		process.exit(1);
	}

	const version = customBinaryPath ? (args[0] && !CCHISTORY_FLAGS.includes(args[0]) ? args[0] : "custom") : args[0];

	const packageJsonPath = path.join(__dirname, "..", "package.json");
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));

	if (args.includes("--version") || args.includes("-v")) {
		console.log(packageJson.version);
		process.exit(0);
	}

	console.log(chalk.cyan(`cchistory v${packageJson.version}`));
	console.log();

	if ((!version || CCHISTORY_FLAGS.includes(version)) && !customBinaryPath) {
		console.log(
			chalk.yellow('Usage: cchistory [version] [--latest] [--binary-path <path>] [--claude-args "<args>"]'),
		);
		console.log(chalk.gray("Examples:"));
		console.log(
			chalk.gray("  cchistory 1.0.0                                          # Extract prompts from version 1.0.0"),
		);
		console.log(
			chalk.gray(
				"  cchistory 1.0.0 --latest                                 # Extract prompts from 1.0.0 to latest",
			),
		);
		console.log(chalk.gray("  cchistory --binary-path /home/claude-code/cli.js         # Use custom binary"));
		console.log(
			chalk.gray('  cchistory --binary-path cli.js --claude-args "--debug"   # Pass args to custom binary'),
		);
		console.log(chalk.gray('  cchistory 1.0.0 --claude-args "--append-system-prompt"   # Pass args to npm version'));
		console.log(chalk.gray("  cchistory --version                                      # Show version"));
		process.exit(1);
	}

	const originalCwd = process.cwd();

	if (customBinaryPath) {
		if (!fs.existsSync(customBinaryPath)) {
			console.error(chalk.red(`Error: Binary path does not exist: ${customBinaryPath}`));
			process.exit(1);
		}

		if (fetchToLatest) {
			console.warn(chalk.yellow("Warning: --latest flag is ignored when using --binary-path"));
			console.warn(chalk.yellow("Only the custom binary will be processed"));
		}

		if (version && version !== "custom" && !version.startsWith("--")) {
			console.log(chalk.gray(`Note: Using label "${version}" for custom binary output`));
		}
	}

	if (fetchToLatest && !customBinaryPath) {
		const latestVersion = getLatestVersion();
		console.log(chalk.blue(`Fetching versions ${version} → ${latestVersion}`));

		const versions = getAllVersionsBetween(version, latestVersion);
		console.log(chalk.gray(`Found ${versions.length} versions`));

		for (const v of versions) {
			try {
				await processVersion(v, originalCwd, customBinaryPath, claudeArgs);
			} catch (error) {
				console.error(chalk.red(`✗ ${v} failed:`));
				console.error(chalk.gray("  Error:"), error instanceof Error ? error.message : String(error));
				if (error instanceof Error && error.stack && process.env.DEBUG) {
					console.error(chalk.gray("  Stack:"), error.stack);
				}
				// Continue with next version
			}
		}

		console.log(chalk.green(`\nCompleted ${versions.length} versions`));
	} else {
		await processVersion(version, originalCwd, customBinaryPath, claudeArgs);
	}
}

main().catch((error) => {
	console.error(chalk.red("Fatal error:"));
	console.error(chalk.gray("Message:"), error instanceof Error ? error.message : String(error));
	if (error instanceof Error && error.stack && process.env.DEBUG) {
		console.error(chalk.gray("Stack trace:"));
		console.error(error.stack);
	}
	if (!process.env.DEBUG) {
		console.error(chalk.gray("\nTip: Set DEBUG=1 to see full stack traces"));
	}
	process.exit(1);
});
