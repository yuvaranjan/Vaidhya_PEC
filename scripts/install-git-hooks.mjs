#!/usr/bin/env node
/**
 * Points git at scripts/githooks/, so the pre-commit hook is version-controlled and
 * every teammate gets it from a clone instead of from a message in the group chat.
 *
 * Runs automatically on `npm install` (via "prepare") and `npm run setup`.
 * Never fails the install — a missing git hook is not worth blocking anyone over.
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

try {
  if (!fs.existsSync(path.join(ROOT, ".git"))) process.exit(0); // not a clone, e.g. a tarball
  execFileSync("git", ["config", "core.hooksPath", "scripts/githooks"], { cwd: ROOT });

  // git on macOS/Linux needs the bit set; on Windows it is ignored.
  const hook = path.join(ROOT, "scripts", "githooks", "pre-commit");
  if (fs.existsSync(hook)) fs.chmodSync(hook, 0o755);

  console.log("git hooks installed (scripts/githooks)");
} catch {
  console.log("git hooks not installed — continuing anyway");
}
