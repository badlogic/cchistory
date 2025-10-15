/**
 * Service wrapper for file system operations
 */

import * as fs from "node:fs";

/**
 * Read file contents as UTF-8 string
 * @param filePath - Path to file
 * @returns File contents
 */
export function readFile(filePath: string): string {
	return fs.readFileSync(filePath, "utf-8");
}

/**
 * Write content to file
 * @param filePath - Path to file
 * @param content - Content to write
 */
export function writeFile(filePath: string, content: string): void {
	fs.writeFileSync(filePath, content, "utf-8");
}

/**
 * Check if file or directory exists
 * @param filePath - Path to check
 * @returns True if exists
 */
export function exists(filePath: string): boolean {
	return fs.existsSync(filePath);
}

/**
 * Create directory (with recursive option)
 * @param dirPath - Directory path
 */
export function createDir(dirPath: string): void {
	fs.mkdirSync(dirPath, { recursive: true });
}

/**
 * Remove directory recursively
 * @param dirPath - Directory path
 */
export function removeDir(dirPath: string): void {
	if (fs.existsSync(dirPath)) {
		fs.rmSync(dirPath, { recursive: true, force: true });
	}
}

/**
 * Read directory contents
 * @param dirPath - Directory path
 * @returns Array of file/directory names
 */
export function readDir(dirPath: string): string[] {
	return fs.readdirSync(dirPath);
}
