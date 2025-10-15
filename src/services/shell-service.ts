/**
 * Service wrapper for shell command execution
 */

import { execSync } from "node:child_process";
import chalk from "chalk";

export interface ExecOptions {
	cwd?: string;
	encoding?: BufferEncoding;
}

/**
 * Execute a shell command and return output
 * @param command - Command to execute
 * @param options - Execution options
 * @returns Command output as string
 */
export function exec(command: string, options?: ExecOptions): string {
	try {
		return execSync(command, {
			encoding: options?.encoding || "utf-8",
			stdio: ["pipe", "pipe", "pipe"],
			cwd: options?.cwd,
		}) as string;
	} catch (error) {
		console.error(chalk.red(`Failed to execute command:`));
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
}

/**
 * Execute a shell command silently (suppresses output in case of error)
 * @param command - Command to execute
 * @param options - Execution options
 * @returns Command output as string
 */
export function execSilent(command: string, options?: ExecOptions): string {
	return execSync(command, {
		encoding: options?.encoding || "utf-8",
		stdio: ["pipe", "pipe", "pipe"],
		cwd: options?.cwd,
	}) as string;
}
