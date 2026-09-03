import { describe, expect, it } from "vitest";
import { MutationCatalog } from "../src/analysis/catalog.js";
import { tempDir, writeFile } from "./helpers.js";

describe("MutationCatalog", () => {
  it("discovers boolean, equality, and comparison mutations", () => {
    const file = writeFile(tempDir(), "src/sample.ts", `
export function truthy(): boolean {
  return true;
}

export function same(left: number, right: number): boolean {
  return left == right;
}

export function larger(left: number, right: number): boolean {
  return left > right;
}

export function smaller(left: number, right: number): boolean {
  return left <= right;
}
`);
    const sites = new MutationCatalog().discover([file]);
    expect(sites.map((site) => site.description)).toEqual([
      "replace true with false",
      "replace == with !=",
      "replace > with >=",
      "replace <= with <"
    ]);
  });

  it("ignores operators inside strings, chars, and comments", () => {
    const file = writeFile(tempDir(), "src/literals.ts", `
export function text(): string {
  return "true == false > <";
}

export function same(left: number, right: number): boolean {
  // left == right > 0
  /* false != true <= >= */
  return left == right;
}
`);
    const sites = new MutationCatalog().discover([file]);
    expect(sites.map((site) => site.description)).toEqual([
      "replace \"true == false > <\" with null",
      "replace == with !="
    ]);
  });

  it("ignores generic type angle brackets and JSX tag brackets", () => {
    const file = writeFile(tempDir(), "src/generic.ts", `
export function names(): Array<string> {
  return ["a"];
}

export function larger(left: number, right: number): boolean {
  return left > right;
}
`);
    const sites = new MutationCatalog().discover([file]);
    expect(sites.map((site) => site.description)).toEqual([
      "replace [\"a\"] with null",
      "replace > with >="
    ]);
  });

  it("discovers arithmetic, logical, strict-equality, and null-replacement mutations", () => {
    const file = writeFile(tempDir(), "src/expanded.ts", `
export function add(left: number, right: number): number {
  return left + right;
}

export function divide(left: number, right: number): number {
  return left / right;
}

export function both(left: boolean, right: boolean): boolean {
  return left && right;
}

export function identical(left: number, right: number): boolean {
  return left === right;
}

export function message(): string {
  return "hello";
}

export function assign(): string {
  let value = helper();
  value = helper();
  return value;
}

export function helper(): string {
  return "x";
}
`);
    const sites = new MutationCatalog().discover([file]);
    expect(sites.map((site) => site.description)).toEqual([
      "replace + with -",
      "replace / with *",
      "replace && with ||",
      "replace === with !==",
      "replace \"hello\" with null",
      "replace helper() with null",
      "replace helper() with null",
      "replace value with null",
      "replace \"x\" with null"
    ]);
  });

  it("discovers unary and constant mutations", () => {
    const file = writeFile(tempDir(), "src/unary.ts", `
export function invert(value: boolean): boolean {
  return !value;
}

export function negative(value: number): number {
  return -value;
}

export function zero(): number {
  return 0;
}

export function one(): number {
  return 1;
}
`);
    const sites = new MutationCatalog().discover([file]);
    expect(sites.map((site) => site.description)).toEqual([
      "replace ! with removed !",
      "replace - with removed -",
      "replace 0 with 1",
      "replace 1 with 0"
    ]);
    expect(sites[0]?.replacementText).toBe("");
    expect(sites[1]?.replacementText).toBe("");
  });

  it("does not treat string concatenation as arithmetic", () => {
    const file = writeFile(tempDir(), "src/concat.ts", `
export function greet(name: string): string {
  return "hello " + name;
}
`);
    const sites = new MutationCatalog().discover([file]);
    expect(sites.map((site) => site.description)).not.toContain("replace + with -");
  });

  it("discovers React and TypeScript-specific mutations", () => {
    const file = writeFile(tempDir(), "src/Button.tsx", `
export function Button({ enabled, label }: { enabled: boolean; label: string }) {
  const title = enabled ? label : "off";
  return (
    <button disabled={!enabled} hidden>
      {enabled && <span>{title}</span>}
    </button>
  );
}

export function maybeName(user?: { name?: string }): string | undefined {
  return user?.name;
}
`);
    const descriptions = new MutationCatalog().discover([file]).map((site) => site.description);
    expect(descriptions).toContain("swap ternary branches");
    expect(descriptions).toContain("replace ! with removed !");
    expect(descriptions).toContain("replace hidden with hidden={false}");
    expect(descriptions).toContain("replace && with ||");
    expect(descriptions.some((description) => description.includes("replace JSX with {null}") || description.startsWith("replace <span"))).toBe(true);
    expect(descriptions).toContain("replace ?. with .");
    expect(descriptions.some((description) => description.startsWith("replace <button"))).toBe(true);
  });
});
