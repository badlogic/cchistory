/**
 * Service wrapper for temporary directory management
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/**
 * Create a temporary working directory with an empty CLAUDE.md file
 * @param prefix - Prefix for the temp directory name
 * @returns Path to the created temporary directory
 */
export function createTempWorkDir(prefix: string): string {
	const tmpBaseDir = os.tmpdir();
	const tmpDirName = `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
	const tmpDir = path.join(tmpBaseDir, tmpDirName);
	fs.mkdirSync(tmpDir, { recursive: true });
	fs.writeFileSync(path.join(tmpDir, "CLAUDE.md"), "");
	return tmpDir;
}

/**
 * Clean up a temporary directory
 * @param tmpDir - Directory to remove
 */
export function cleanupTempDir(tmpDir: string): void {
	if (fs.existsSync(tmpDir)) {
		fs.rmSync(tmpDir, { recursive: true, force: true });
	}
}
