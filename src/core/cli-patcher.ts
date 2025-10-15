/**
 * Pure string manipulation for patching Claude CLI version checks
 *
 * FRAGILE: This patching relies on specific string patterns in cli.js
 * If Claude Code changes the version warning format or uses minification,
 * this may fail (acceptable - we'll see the warning in that case)
 */

export interface PatchResult {
	patched: boolean;
	content: string;
	message?: string;
}

/**
 * Find the function containing the version warning and patch it
 * @param cliContent - Content of the CLI file
 * @returns Patch result with patched content
 */
export function patchCliVersionCheck(cliContent: string): PatchResult {
	const warningText = "It looks like your version of Claude Code";
	const warningIndex = cliContent.indexOf(warningText);

	if (warningIndex === -1) {
		return {
			patched: false,
			content: cliContent,
			message: "Warning text not found - version check may not exist",
		};
	}

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

	// Extract the function declaration
	const functionDeclaration = cliContent.substring(functionIndex, openBraceIndex + 1);

	// Replace the function body with an empty block
	const patchedFunction = `${functionDeclaration} /* Version check disabled by patch */ }`;
	const patchedContent =
		cliContent.substring(0, functionIndex) + patchedFunction + cliContent.substring(closeBraceIndex + 1);

	return {
		patched: true,
		content: patchedContent,
		message: "Version check successfully patched",
	};
}
