import { describe, expect, it } from "vitest";
import { patchCliVersionCheck } from "./cli-patcher.js";

describe("cli-patcher", () => {
	describe("patchCliVersionCheck", () => {
		it("patches version check successfully", () => {
			const cliContent = `
function checkVersion() {
  console.log("It looks like your version of Claude Code is outdated");
  process.exit(1);
}
      `;

			const result = patchCliVersionCheck(cliContent);

			expect(result.patched).toBe(true);
			expect(result.content).toContain("/* Version check disabled by patch */");
			expect(result.content).not.toContain("process.exit(1)");
			expect(result.message).toBe("Version check successfully patched");
		});

		it("returns unpatched when warning text not found", () => {
			const cliContent = `
function someOtherFunction() {
  console.log("Some other message");
}
      `;

			const result = patchCliVersionCheck(cliContent);

			expect(result.patched).toBe(false);
			expect(result.content).toBe(cliContent);
			expect(result.message).toBe("Warning text not found - version check may not exist");
		});

		it("handles complex function bodies", () => {
			const cliContent = `
function checkVersion() {
  const outdated = true;
  if (outdated) {
    console.log("It looks like your version of Claude Code is old");
    console.error("Please update");
    for (let i = 0; i < 10; i++) {
      console.log("Warning " + i);
    }
  }
}
      `;

			const result = patchCliVersionCheck(cliContent);

			expect(result.patched).toBe(true);
			expect(result.content).toContain("/* Version check disabled by patch */");
		});

		it("handles nested braces correctly", () => {
			const cliContent = `
function checkVersion() {
  if (true) {
    if (false) {
      console.log("It looks like your version of Claude Code is outdated");
    }
  }
}
      `;

			const result = patchCliVersionCheck(cliContent);

			expect(result.patched).toBe(true);
			expect(result.content).toContain("function checkVersion()");
			expect(result.content).toContain("/* Version check disabled by patch */");
		});

		it("throws error when function keyword not found before warning", () => {
			const cliContent = `
const checkVersion = () => {
  console.log("It looks like your version of Claude Code is outdated");
};
      `;

			expect(() => patchCliVersionCheck(cliContent)).toThrow(
				"Could not find function declaration before warning text",
			);
		});

		it("throws error when opening brace not found", () => {
			const cliContent = `
function checkVersion()
  console.log("It looks like your version of Claude Code is outdated");
      `;

			expect(() => patchCliVersionCheck(cliContent)).toThrow(
				"Could not find opening brace after function declaration",
			);
		});

		it("preserves content before and after patched function", () => {
			const cliContent = `
const before = "something before";

function checkVersion() {
  console.log("It looks like your version of Claude Code is outdated");
}

const after = "something after";
      `;

			const result = patchCliVersionCheck(cliContent);

			expect(result.patched).toBe(true);
			expect(result.content).toContain('const before = "something before"');
			expect(result.content).toContain('const after = "something after"');
			expect(result.content).toContain("/* Version check disabled by patch */");
		});

		it("handles warning text at various positions in function", () => {
			const cliContent = `
function checkVersion() {
  const a = 1;
  const b = 2;
  console.log("It looks like your version of Claude Code is old");
  return false;
}
      `;

			const result = patchCliVersionCheck(cliContent);

			expect(result.patched).toBe(true);
			expect(result.content).toContain("/* Version check disabled by patch */");
		});

		it("throws error when closing brace not found (unmatched braces)", () => {
			const cliContent = `
function checkVersion() {
  if (true) {
    console.log("It looks like your version of Claude Code is outdated");
    // Missing closing brace for if statement
`;

			expect(() => patchCliVersionCheck(cliContent)).toThrow("Could not find matching closing brace");
		});
	});
});
