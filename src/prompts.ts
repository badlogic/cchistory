#!/usr/bin/env -S node --no-warnings

import { execSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import chalk from "chalk";

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
				content: Array<{
					type: string;
					text?: string;
					cache_control?: any;
				}>;
			}>;
			temperature?: number;
			system?: Array<{
				type: string;
				text: string;
				cache_control?: any;
			}>;
			tools?: Array<{
				name: string;
				description: string;
				input_schema: any;
			}>;
		};
	};
	response: any;
}

function parseVersion(version: string): { major: number; minor: number; patch: number } {
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
	} catch (error: any) {
		console.error(chalk.red("Failed to fetch latest version from npm:"));
		console.error(chalk.gray("Command: npm view @anthropic-ai/claude-code version"));
		if (error.stdout) console.error(chalk.gray("stdout:"), error.stdout);
		if (error.stderr) console.error(chalk.gray("stderr:"), error.stderr);
		console.error(chalk.gray("Error:"), error.message || error);
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
	} catch (error: any) {
		console.error(chalk.red("Failed to fetch version list from npm:"));
		console.error(chalk.gray("Command: npm view @anthropic-ai/claude-code versions --json"));
		if (error.stdout) console.error(chalk.gray("stdout:"), error.stdout);
		if (error.stderr) console.error(chalk.gray("stderr:"), error.stderr);
		console.error(chalk.gray("Error:"), error.message || error);
		process.exit(1);
	}
}

function getVersionReleaseDate(version: string): string {
	try {
		const output = execSync(`npm view @anthropic-ai/claude-code@${version} time --json`, {
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

async function processVersion(version: string, originalCwd: string) {
	// Check if prompts file already exists
	const outputPath = path.join(originalCwd, `prompts-${version}.md`);
	if (fs.existsSync(outputPath)) {
		console.log(chalk.gray(`Skipping ${version} - already exists`));
		return;
	}

	console.log(chalk.blue(`Processing ${version}...`));
	// Create a unique temp directory
	const tmpBaseDir = os.tmpdir();
	const tmpDirName = `claude-history-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
	const tmpDir = path.join(tmpBaseDir, tmpDirName);
	const packageDir = path.join(tmpDir, "package");
	const cliPath = path.join(packageDir, "cli.js");

	// Create tmp directory
	fs.mkdirSync(tmpDir, { recursive: true });

	// Download and extract package
	try {
		execSync(`npm pack @anthropic-ai/claude-code@${version}`, {
			cwd: tmpDir,
			stdio: ["pipe", "pipe", "pipe"],
		});
	} catch (error: any) {
		console.error(chalk.red(`Failed to download version ${version} from npm:`));
		console.error(chalk.gray(`Command: npm pack @anthropic-ai/claude-code@${version}`));
		if (error.stdout) console.error(chalk.gray("stdout:"), error.stdout);
		if (error.stderr) console.error(chalk.gray("stderr:"), error.stderr);
		console.error(chalk.gray("Error:"), error.message || error);
		throw error;
	}

	const tarFile = path.join(tmpDir, `anthropic-ai-claude-code-${version}.tgz`);
	execSync(`tar -xzf "${tarFile}"`, {
		cwd: tmpDir,
		stdio: ["pipe", "pipe", "pipe"],
	});

	// Patch cli.js silently

	// Check if cli.js exists
	if (!fs.existsSync(cliPath)) {
		console.error(chalk.red(`CLI file not found for version ${version}`));
		console.error(chalk.gray("Expected path:"), cliPath);
		console.error(chalk.gray("Package contents:"));
		try {
			const packageFiles = fs.readdirSync(packageDir);
			packageFiles.forEach(file => console.error(chalk.gray(`  - ${file}`)));
		} catch (e) {
			console.error(chalk.gray("  Could not list package directory"));
		}
		throw new Error(`CLI file not found at ${cliPath}`);
	}

	// Read the CLI file
	let cliContent = fs.readFileSync(cliPath, "utf-8");

	// Look for the version warning message
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
		cliContent = cliContent.substring(0, functionIndex) + patchedFunction + cliContent.substring(closeBraceIndex + 1);
	} else {
		console.error(chalk.yellow(`Warning: Could not find version check to patch in version ${version}`));
		console.error(chalk.gray("This version might not have the version check, continuing anyway..."));
		// Don't throw, just continue - older versions might not have this check
	}

	// Write the patched file
	fs.writeFileSync(cliPath, cliContent);

	// Write empty CLAUDE.md file
	fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "");

	try {
		// Change to tmp directory and run claude-trace
		process.chdir(tmpDir);

		// Capture output to only show on error
		let _cmdOutput = "";
		try {
			// Use npx with -y flag to automatically confirm any prompts
			// Use --no-open to prevent browser from opening
			_cmdOutput = execSync(
				`npx --node-options="--no-warnings" -y @mariozechner/claude-trace --claude-path ./package/cli.js --no-open --run-with -p "${new Date().toISOString()} is the date. Write a haiku about it."`,
				{
					encoding: "utf-8",
					stdio: ["pipe", "pipe", "pipe"],
				},
			);
		} catch (error: any) {
			console.error(chalk.red(`\nFailed to run claude-trace for version ${version}:`));
			console.error(chalk.gray("Command: npx --node-options=\"--no-warnings\" -y @mariozechner/claude-trace ..."));
			if (error.stdout) {
				console.error(chalk.gray("stdout:"));
				console.error(error.stdout);
			}
			if (error.stderr) {
				console.error(chalk.gray("stderr:"));
				console.error(error.stderr);
			}
			console.error(chalk.gray("Error:"), error.message || error);
			console.error(chalk.gray("Exit code:"), error.status || error.code || "unknown");
			throw error;
		}

		// Find the generated JSONL file
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

		// Find the first non-Haiku request
		const nonHaikuRequest = data.find(
			(pair) => pair.request?.body?.model && !pair.request.body.model.toLowerCase().includes("haiku"),
		);

		if (!nonHaikuRequest) {
			throw new Error("No non-Haiku request found in the log");
		}

		// Extract the required information
		const request = nonHaikuRequest.request;

		// Extract user message - get all content blocks from the first user message
		const userMessage =
			request.body.messages
				.find((msg) => msg.role === "user")
				?.content.filter((content) => content.type === "text")
				.map((content) => content.text || "")
				.join("\n") || "";

		// Extract system prompt - join without double newlines
		const systemPrompt = (request.body.system || [])
			.filter((s) => s.type === "text")
			.map((s) => s.text)
			.join("\n");

		// Function to add extra # to markdown headers
		const indentHeaders = (text: string): string => {
			return text.split('\n').map(line => {
				const match = line.match(/^(#+)(\s+)/);
				if (match) {
					return '#' + line;
				}
				return line;
			}).join('\n');
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

		// Get release date
		const releaseDate = getVersionReleaseDate(version);

		// Generate output
		const output = `# Claude Code Version ${version}

Release Date: ${releaseDate}

# User Message

${indentHeaders(userMessage)}

# System Prompt

${indentHeaders(systemPrompt)}

# Tools

${tools}
`;

		// Write to prompts-{version}.md in the original working directory
		const outputPath = path.join(originalCwd, `prompts-${version}.md`);
		fs.writeFileSync(outputPath, output);

		console.log(chalk.green(`✓ ${version} → ${path.basename(outputPath)}`));
	} finally {
		// Change back to original directory and clean up
		process.chdir(originalCwd);
		if (fs.existsSync(tmpDir)) {
			fs.rmSync(tmpDir, { recursive: true, force: true });
		}
	}
}

async function main() {
	const args = process.argv.slice(2);
	const version = args[0];
	const fetchToLatest = args.includes("--latest");

	// Get package version
	const packageJsonPath = path.join(__dirname, "..", "package.json");
	const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
	
	// Handle --version flag
	if (args.includes("--version") || args.includes("-v")) {
		console.log(packageJson.version);
		process.exit(0);
	}

	// Show version at startup
	console.log(chalk.cyan(`cchistory v${packageJson.version}`));
	console.log();

	if (!version || version.startsWith("--")) {
		console.log(chalk.yellow("Usage: cchistory <version> [--latest]"));
		console.log(chalk.gray("Examples:"));
		console.log(chalk.gray("  cchistory 1.0.0                # Extract prompts from version 1.0.0"));
		console.log(chalk.gray("  cchistory 1.0.0 --latest       # Extract prompts from 1.0.0 to latest"));
		console.log(chalk.gray("  cchistory --version            # Show version"));
		process.exit(1);
	}

	// Store the original working directory
	const originalCwd = process.cwd();

	if (fetchToLatest) {
		const latestVersion = getLatestVersion();
		console.log(chalk.blue(`Fetching versions ${version} → ${latestVersion}`));

		const versions = getAllVersionsBetween(version, latestVersion);
		console.log(chalk.gray(`Found ${versions.length} versions`));

		for (const v of versions) {
			try {
				await processVersion(v, originalCwd);
			} catch (error: any) {
				console.error(chalk.red(`✗ ${v} failed:`));
				console.error(chalk.gray("  Error:"), error.message || error);
				if (error.stack && process.env.DEBUG) {
					console.error(chalk.gray("  Stack:"), error.stack);
				}
				// Continue with next version
			}
		}

		console.log(chalk.green(`\nCompleted ${versions.length} versions`));
	} else {
		await processVersion(version, originalCwd);
	}
}

main().catch((error: any) => {
	console.error(chalk.red("Fatal error:"));
	console.error(chalk.gray("Message:"), error.message || error);
	if (error.stack && process.env.DEBUG) {
		console.error(chalk.gray("Stack trace:"));
		console.error(error.stack);
	}
	if (!process.env.DEBUG) {
		console.error(chalk.gray("\nTip: Set DEBUG=1 to see full stack traces"));
	}
	process.exit(1);
});
