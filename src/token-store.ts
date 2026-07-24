import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { RentManagerTransportError } from "./errors.js";
import type { Awaitable } from "./types.js";

export interface TokenStore {
  load(): Awaitable<string | null>;
  save(token: string): Awaitable<void>;
  clear(): Awaitable<void>;
}

export class InMemoryTokenStore implements TokenStore {
  #token: string | null;

  constructor(token: string | null = null) {
    this.#token = token;
  }

  load(): string | null {
    return this.#token;
  }

  save(token: string): void {
    this.#token = token;
  }

  clear(): void {
    this.#token = null;
  }
}

export class FileTokenStore implements TokenStore {
  readonly path: string;

  constructor(filePath: string | URL) {
    this.path = filePath instanceof URL ? fileURLToPath(filePath) : path.resolve(filePath);
  }

  async load(): Promise<string | null> {
    try {
      const payload = JSON.parse(await readFile(this.path, "utf8")) as unknown;
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
      const token = (payload as Record<string, unknown>).token;
      return typeof token === "string" && token.trim() ? token : null;
    } catch {
      return null;
    }
  }

  async save(token: string): Promise<void> {
    const directory = path.dirname(this.path);
    try {
      await mkdir(directory, { recursive: true, mode: 0o700 });
      await writeFile(this.path, JSON.stringify({ token }), { encoding: "utf8", mode: 0o600 });
      await chmod(directory, 0o700).catch(() => undefined);
      await chmod(this.path, 0o600).catch(() => undefined);
    } catch (error) {
      throw new RentManagerTransportError(`Unable to write token cache file ${this.path}.`, {
        cause: error,
      });
    }
  }

  async clear(): Promise<void> {
    await rm(this.path, { force: true });
  }
}
