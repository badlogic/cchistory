#!/usr/bin/env node

import * as path from "node:path";
import chalk from "chalk";
import { parse, quote } from "shell-quote";
import { extractSystemPrompt, findAndExtractUserMessage } from "./core/content-extractor.js";
import { filterAndSortTools, hasTools, selectBestRequest } from "./core/request-filter.js";
import { exists, readDir, readFile, writeFile } from "./services/file-service.js";
import {
	downloadPackage,
	getAllVersionsBetween,
	getLatestVersion,
	getVersionReleaseDate,
} from "./services/npm-service.js";
import { exec } from "./services/shell-service.js";
import { cleanupTempDir, createTempWorkDir } from "./services/temp-service.js";
import type { RequestResponsePair } from "./types/request.js";

const CCHISTORY_FLAGS = ["--latest", "--binary-path", "--claude-args", "--version", "-v", "--help", "-h"];

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

	let cliPath: string;
	let tmpDir: string | undefined;
	let packageDir: string | undefined;

	if (customBinaryPath) {
		cliPath = customBinaryPath;
	} else {
		tmpDir = createTempWorkDir("claude-history");
		packageDir = path.join(tmpDir, "package");
		cliPath = path.join(packageDir, "cli.js");

		downloadPackage(versionOrLabel, tmpDir);

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
	}

	const cliContent = readFile(cliPath);

	const patchResult = { patched: false, content: cliContent };
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

		if (functionIndex !== -1) {
			let openBraceIndex = -1;
			for (let i = functionIndex; i < cliContent.length; i++) {
				if (cliContent[i] === "{") {
					openBraceIndex = i;
					break;
				}
			}

			if (openBraceIndex !== -1) {
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

				if (closeBraceIndex !== -1) {
					const functionDeclaration = cliContent.substring(functionIndex, openBraceIndex + 1);
					const patchedFunction = `${functionDeclaration} /* Version check disabled */ }`;
					patchResult.content =
						cliContent.substring(0, functionIndex) + patchedFunction + cliContent.substring(closeBraceIndex + 1);
					patchResult.patched = true;
				}
			}
		}
	}

	if (patchResult.patched) {
		writeFile(cliPath, patchResult.content);
	} else if (!customBinaryPath) {
		console.error(chalk.yellow(`Warning: Could not find version check to patch in version ${versionOrLabel}`));
		console.error(chalk.gray("This version might not have the version check, continuing anyway..."));
	}

	try {
		let workDir: string;
		if (customBinaryPath) {
			tmpDir = createTempWorkDir("claude-history-custom");
			workDir = tmpDir;
		} else {
			if (!tmpDir) {
				throw new Error("Internal error: tmpDir not initialized for npm package");
			}
			workDir = tmpDir;
		}

		process.chdir(workDir);

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

		try {
			exec(command);
		} catch (error) {
			console.error(
				chalk.red(
					`\nFailed to run claude-trace for ${customBinaryPath ? "custom binary" : `version ${versionOrLabel}`}:`,
				),
			);
			console.error(chalk.gray(`Command: ${command}`));
			throw error;
		}

		if (!tmpDir) {
			throw new Error("Internal error: tmpDir not initialized");
		}

		const claudeTraceDir = path.join(tmpDir, ".claude-trace");
		const files = readDir(claudeTraceDir);
		const jsonlFile = files.find((f) => f.startsWith("log-") && f.endsWith(".jsonl"));

		if (!jsonlFile) {
			throw new Error("No JSONL log file found in .claude-trace directory");
		}

		const jsonlPath = path.join(claudeTraceDir, jsonlFile);
		const jsonlContent = readFile(jsonlPath);
		const data: RequestResponsePair[] = jsonlContent
			.trim()
			.split("\n")
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line));

		const selectedRequest = selectBestRequest(data);

		if (!hasTools(selectedRequest)) {
			console.warn(chalk.yellow("Warning: Selected request has no tools. This may not be a Claude Code request."));
		}

		const request = selectedRequest.request;

		const userMessage = findAndExtractUserMessage(request.body.messages);
		const systemPrompt = extractSystemPrompt(request.body);
		const tools = filterAndSortTools(request.body.tools);

		const releaseDate = customBinaryPath ? "Custom Binary" : getVersionReleaseDate(versionOrLabel);
		const versionLabel = customBinaryPath ? `Custom Binary (${outputFilename})` : versionOrLabel;

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

		const toolsFormatted = tools
			.map((tool) => {
				const schemaStr = JSON.stringify(tool.input_schema, null, 2);
				const indentedDescription = indentHeaders(indentHeaders(tool.description));
				return `## ${tool.name}\n\n${indentedDescription}\n${schemaStr}`;
			})
			.join("\n\n---\n\n");

		const output = `# Claude Code Version ${versionLabel}

Release Date: ${releaseDate}

# User Message

${indentHeaders(userMessage)}

# System Prompt

${indentHeaders(systemPrompt)}

# Tools

${toolsFormatted}
`;

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
		process.chdir(originalCwd);
		if (tmpDir) {
			cleanupTempDir(tmpDir);
		}
	}
}

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
