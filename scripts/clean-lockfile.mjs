/**
 * Strips Replit-internal registry URLs from package-lock.json.
 *
 * Replit intercepts npm traffic at the network level and rewrites
 * "resolved" URLs to http://package-firewall.replit.local/npm/...
 * This breaks npm ci on Vercel, GitHub Actions, and any external CI.
 *
 * This script replaces every Replit proxy URL with the canonical
 * https://registry.npmjs.org/ URL so the lockfile is always safe to commit.
 *
 * Run automatically via the "postinstall" hook.
 */

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const lockfilePath = resolve(__dirname, "..", "package-lock.json");

const REPLIT_REGISTRY = "http://package-firewall.replit.local/npm/";
const PUBLIC_REGISTRY = "https://registry.npmjs.org/";

if (!existsSync(lockfilePath)) {
  process.exit(0);
}

const original = readFileSync(lockfilePath, "utf8");

if (!original.includes(REPLIT_REGISTRY)) {
  process.exit(0);
}

const cleaned = original.replaceAll(REPLIT_REGISTRY, PUBLIC_REGISTRY);
const count = (original.match(new RegExp(REPLIT_REGISTRY.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;

writeFileSync(lockfilePath, cleaned, "utf8");
console.log(`[clean-lockfile] Replaced ${count} Replit registry URL(s) with ${PUBLIC_REGISTRY}`);
