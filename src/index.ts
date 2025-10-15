#!/usr/bin/env node

import * as path from "node:path";
import chalk from "chalk";
import { parse, quote } from "shell-quote";
import { patchCliVersionCheck } from "./core/cli-patcher.js";
import { extractSystemPrompt, findAndExtractUserMessage } from "./core/content-extractor.js";
// Core imports
import { parseJsonl } from "./core/jsonl-parser.js";
import { formatOutput } from "./core/output-formatter.js";
import { filterAndSortTools, hasTools, selectBestRequest } from "./core/request-filter.js";
import { exists, readDir, readFile, writeFile } from "./services/file-service.js";
// Service imports
import {
	downloadPackage,
	getAllVersionsBetween,
	getLatestVersion,
	getVersionReleaseDate,
} from "./services/npm-service.js";
import { exec } from "./services/shell-service.js";
import { cleanupTempDir, createTempWorkDir } from "./services/temp-service.js";

/** cchistory's own flags - used for argument validation */
const CCHISTORY_FLAGS = ["--latest", "--binary-path", "--claude-args", "--version", "-v", "--help", "-h"];

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

	if (exists(outputPath)) {
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

		// Download package from npm
		downloadPackage(versionOrLabel, tmpDir);

		// Extract tarball
		const tarFile = path.join(tmpDir, `anthropic-ai-claude-code-${versionOrLabel}.tgz`);
		exec(`tar -xzf ${quote([tarFile])}`, { cwd: tmpDir });

		if (!exists(cliPath)) {
			console.error(chalk.red(`CLI file not found for version ${versionOrLabel}`));
			console.error(chalk.gray("Expected path:"), cliPath);
			console.error(chalk.gray("Package contents:"));
			try {
				const packageFiles = readDir(packageDir);
				packageFiles.forEach((file) => console.error(chalk.gray(`  - ${file}`)));
			} catch (_e) {
				console.error(chalk.gray("  Could not list package directory"));
			}
			throw new Error(`CLI file not found at ${cliPath}`);
		}

		// Patch version check
		const cliContent = readFile(cliPath);
		const patchResult = patchCliVersionCheck(cliContent);

		if (patchResult.patched) {
			writeFile(cliPath, patchResult.content);
		} else {
			console.error(chalk.yellow(`Warning: Could not find version check to patch in version ${versionOrLabel}`));
			console.error(chalk.gray("This version might not have the version check, continuing anyway..."));
		}
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

		exec(command);

		// Find the generated JSONL file
		if (!tmpDir) {
			throw new Error("Internal error: tmpDir not initialized");
		}
		const claudeTraceDir = path.join(tmpDir, ".claude-trace");
		const files = readDir(claudeTraceDir);
		const jsonlFile = files.find((f) => f.startsWith("log-") && f.endsWith(".jsonl"));

		if (!jsonlFile) {
			throw new Error("No JSONL log file found in .claude-trace directory");
		}

		// Parse the JSONL file
		const jsonlPath = path.join(claudeTraceDir, jsonlFile);
		const jsonlContent = readFile(jsonlPath);
		const data = parseJsonl(jsonlContent);

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

		// Select the best request
		const selectedRequest = selectBestRequest(data);

		if (!hasTools(selectedRequest)) {
			console.warn(chalk.yellow("Warning: Selected request has no tools. This may not be a Claude Code request."));
		}

		// Extract the required information
		const request = selectedRequest.request;
		const userMessage = findAndExtractUserMessage(request.body.messages);
		const systemPrompt = extractSystemPrompt(request.body);

		// Filter and sort tools
		const tools = filterAndSortTools(request.body.tools);

		// Get release date and version label
		const releaseDate = customBinaryPath ? "Custom Binary" : getVersionReleaseDate(versionOrLabel);
		const versionLabel = customBinaryPath ? `Custom Binary (${outputFilename})` : versionOrLabel;

		// Format output
		const output = formatOutput({
			versionLabel,
			releaseDate,
			userMessage,
			systemPrompt,
			tools,
		});

		writeFile(outputPath, output);

		console.log(
			chalk.green(`✓ ${customBinaryPath ? "custom binary" : versionOrLabel} → ${path.basename(outputPath)}`),
		);
	} catch (error) {
		console.error(
			chalk.red(`\nFailed to process ${customBinaryPath ? "custom binary" : `version ${versionOrLabel}`}:`),
		);
		throw error;
	} finally {
		// Change back to original directory and clean up
		process.chdir(originalCwd);
		if (tmpDir) {
			cleanupTempDir(tmpDir);
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
	const packageJson = JSON.parse(readFile(packageJsonPath));

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
		if (!exists(customBinaryPath)) {
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
