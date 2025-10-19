/**
 * Service wrapper for npm operations
 */

import { execSync } from "node:child_process";
import chalk from "chalk";
import { quote } from "shell-quote";
import { compareVersions } from "../core/version-utils.js";

/**
 * Get the latest published version of Claude Code from npm
 * @returns Latest version string
 */
export function getLatestVersion(): string {
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

/**
 * Get all versions between start and end (inclusive)
 * @param startVersion - Starting version
 * @param endVersion - Ending version
 * @returns Sorted array of versions
 */
export function getAllVersionsBetween(startVersion: string, endVersion: string): string[] {
	try {
		const output = execSync("npm view @anthropic-ai/claude-code versions --json", {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const allVersions: string[] = JSON.parse(output);

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

/**
 * Get release date for a specific version
 * @param version - Version to look up
 * @returns Release date in YYYY-MM-DD format, or "Unknown" if not found
 */
export function getVersionReleaseDate(version: string): string {
	try {
		const output = execSync(`npm view @anthropic-ai/claude-code@${quote([version])} time --json`, {
			encoding: "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const times = JSON.parse(output);
		const releaseDate = new Date(times[version]);
		return releaseDate.toISOString().split("T")[0];
	} catch (_error) {
		return "Unknown";
	}
}

/**
 * Download a specific version using npm pack
 * @param version - Version to download
 * @param targetDir - Directory to download into
 */
export function downloadPackage(version: string, targetDir: string): void {
	try {
		execSync(`npm pack @anthropic-ai/claude-code@${quote([version])}`, {
			cwd: targetDir,
			stdio: ["pipe", "pipe", "pipe"],
		});
	} catch (error) {
		console.error(chalk.red(`Failed to download version ${version} from npm:`));
		console.error(chalk.gray(`Command: npm pack @anthropic-ai/claude-code@${version}`));
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
}
