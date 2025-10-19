/**
 * Pure utility functions for version parsing and comparison
 */

export interface Version {
	major: number;
	minor: number;
	patch: number;
}

/**
 * Parse a semantic version string into its components
 * @param version - Version string in format "major.minor.patch"
 * @returns Parsed version object
 */
export function parseVersion(version: string): Version {
	const parts = version.split(".");
	return {
		major: parseInt(parts[0], 10),
		minor: parseInt(parts[1], 10),
		patch: parseInt(parts[2], 10),
	};
}

/**
 * Compare two version strings
 * @param a - First version string
 * @param b - Second version string
 * @returns Negative if a < b, positive if a > b, zero if equal
 */
export function compareVersions(a: string, b: string): number {
	const va = parseVersion(a);
	const vb = parseVersion(b);

	if (va.major !== vb.major) return va.major - vb.major;
	if (va.minor !== vb.minor) return va.minor - vb.minor;
	return va.patch - vb.patch;
}
