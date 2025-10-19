import { describe, expect, it } from "vitest";
import { compareVersions, parseVersion } from "./version-utils.js";

describe("version-utils", () => {
	describe("parseVersion", () => {
		it("parses a simple version string", () => {
			expect(parseVersion("1.2.3")).toEqual({
				major: 1,
				minor: 2,
				patch: 3,
			});
		});

		it("parses version with zeros", () => {
			expect(parseVersion("0.0.0")).toEqual({
				major: 0,
				minor: 0,
				patch: 0,
			});
		});

		it("parses version with large numbers", () => {
			expect(parseVersion("10.20.30")).toEqual({
				major: 10,
				minor: 20,
				patch: 30,
			});
		});
	});

	describe("compareVersions", () => {
		it("returns negative when first version is less than second", () => {
			expect(compareVersions("1.2.3", "1.2.4")).toBeLessThan(0);
			expect(compareVersions("1.2.3", "1.3.0")).toBeLessThan(0);
			expect(compareVersions("1.2.3", "2.0.0")).toBeLessThan(0);
		});

		it("returns positive when first version is greater than second", () => {
			expect(compareVersions("1.2.4", "1.2.3")).toBeGreaterThan(0);
			expect(compareVersions("1.3.0", "1.2.3")).toBeGreaterThan(0);
			expect(compareVersions("2.0.0", "1.2.3")).toBeGreaterThan(0);
		});

		it("returns zero when versions are equal", () => {
			expect(compareVersions("1.2.3", "1.2.3")).toBe(0);
			expect(compareVersions("0.0.0", "0.0.0")).toBe(0);
			expect(compareVersions("10.20.30", "10.20.30")).toBe(0);
		});

		it("compares major version first", () => {
			expect(compareVersions("2.0.0", "1.9.9")).toBeGreaterThan(0);
			expect(compareVersions("1.0.0", "2.0.0")).toBeLessThan(0);
		});

		it("compares minor version when major is equal", () => {
			expect(compareVersions("1.2.0", "1.1.9")).toBeGreaterThan(0);
			expect(compareVersions("1.1.0", "1.2.0")).toBeLessThan(0);
		});

		it("compares patch version when major and minor are equal", () => {
			expect(compareVersions("1.2.3", "1.2.2")).toBeGreaterThan(0);
			expect(compareVersions("1.2.2", "1.2.3")).toBeLessThan(0);
		});
	});
});
