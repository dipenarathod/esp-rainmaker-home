#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Espressif Systems (Shanghai) CO LTD
// SPDX-License-Identifier: Apache-2.0

/**
 * Download a GitLab Secure File. Used by the `env:pull:*` and `plist:pull:*`
 * npm scripts so developers can refresh .env.global / .env.cn / .env.web and
 * ios/APP/GoogleService-Info-Global.plist without hand-copying values. CI
 * uses the download-secure-files installer directly in .gitlab-ci.yml — this
 * script is for local dev only.
 *
 * Usage:
 *   node scripts/env-pull.js <secure-file-name> [out-path]
 *
 * When out-path is omitted, writes to the repo root under the Secure File's
 * own name.
 *
 * Behavior on failure:
 *   - If the download (or any prerequisite like `glab`/auth) fails but the
 *     target file already exists on disk, exits 0 after printing a warning
 *     with the existing file's mtime. Lets `prebuild:latest` degrade to the
 *     local copy instead of blocking the build.
 *   - Only exits non-zero when the pull fails AND no local fallback exists.
 *
 * Env overrides (useful when cloning from the GitHub mirror):
 *   GITLAB_HOST    — override the default GitLab host
 *   GITLAB_PROJECT — override the default project path
 */

const { execFileSync, spawnSync } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const name = process.argv[2];
const outArg = process.argv[3];
if (!name) {
  console.error("Usage: node scripts/env-pull.js <secure-file-name> [out-path]");
  process.exit(1);
}

// GITLAB_HOST and GITLAB_PROJECT must be set in your shell (or via your
// dotenv tool) to point at the GitLab instance + project that owns the
// Secure Files.
const HOST = process.env.GITLAB_HOST;
const PROJECT = process.env.GITLAB_PROJECT;
if (!HOST || !PROJECT) {
  console.error(
    "env-pull: set GITLAB_HOST and GITLAB_PROJECT (e.g. GITLAB_HOST=gitlab.example.com:1234 GITLAB_PROJECT=group/repo)."
  );
  process.exit(1);
}

const out = path.resolve(outArg || name);
const relOut = path.relative(process.cwd(), out) || name;

function hasGlab() {
  const r = spawnSync("glab", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function isAuthenticated() {
  const r = spawnSync("glab", ["auth", "status"], { stdio: "ignore" });
  return r.status === 0;
}

/**
 * Called whenever the fetch can't complete. If the target already exists on
 * disk, log a warning and exit 0 so the caller (e.g. `prebuild:latest`) keeps
 * going with the stale-but-present local copy. If the target is missing,
 * exit 1 with the original failure reason so the build halts.
 */
function fallbackOrFail(reason) {
  if (fs.existsSync(out)) {
    const mtime = fs.statSync(out).mtime.toISOString();
    console.warn(`⚠ ${reason}`);
    console.warn(`  Using existing ${relOut} (mtime: ${mtime})`);
    process.exit(0);
  }
  console.error(`✗ ${reason}`);
  console.error(`  No local ${relOut} to fall back to.`);
  process.exit(1);
}

if (!hasGlab()) {
  fallbackOrFail("glab CLI not found (install: brew install glab)");
}

if (!isAuthenticated()) {
  fallbackOrFail(
    `Not authenticated to GitLab (run: glab auth login --hostname ${HOST})`
  );
}

// Download to a temp path first, then atomic-rename into place. Prevents a
// partially-written file from clobbering a working local copy if the stream
// aborts mid-download.
const tmp = path.join(os.tmpdir(), `env-pull-${process.pid}-${path.basename(name)}`);
console.log(`Fetching ${name} from ${HOST}/${PROJECT}…`);

try {
  execFileSync(
    "glab",
    [
      "securefile",
      "download",
      "--repo",
      `${HOST}/${PROJECT}`,
      "--name",
      name,
      "--path",
      tmp,
    ],
    { stdio: "inherit" }
  );
} catch (e) {
  try { fs.rmSync(tmp, { force: true }); } catch {}
  fallbackOrFail(`Failed to download ${name}: ${e.message || e}`);
}

try {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.renameSync(tmp, out);
} catch (e) {
  // renameSync across filesystems fails with EXDEV — copy+unlink in that case.
  if (e.code === "EXDEV") {
    fs.copyFileSync(tmp, out);
    fs.rmSync(tmp, { force: true });
  } else {
    try { fs.rmSync(tmp, { force: true }); } catch {}
    fallbackOrFail(`Failed to write ${relOut}: ${e.message || e}`);
  }
}

console.log(`✓ Wrote ${relOut}`);
