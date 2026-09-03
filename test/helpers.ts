import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

export function captureStream(): { stream: NodeJS.WritableStream; text(): string } {
  let text = "";
  const stream = {
    write(chunk: string | Uint8Array): boolean {
      text += chunk.toString();
      return true;
    }
  } as NodeJS.WritableStream;
  return {
    stream,
    text: () => text
  };
}

export function tempDir(): string {
  return mkdtempSync(path.join(os.tmpdir(), "mutate4ts-"));
}

export function writeFile(root: string, relative: string, contents: string): string {
  const file = path.join(root, relative);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, contents, "utf8");
  return file;
}
