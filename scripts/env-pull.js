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
 * Env overrides (useful when cloning from the GitHub mirror):
 *   GITLAB_HOST    — override the default GitLab host
 *   GITLAB_PROJECT — override the default project path
 */

const { execFileSync, spawnSync } = require("child_process");
const path = require("path");

const name = process.argv[2];
const outArg = process.argv[3];
if (!name) {
  console.error("Usage: node scripts/env-pull.js <secure-file-name> [out-path]");
  process.exit(1);
}

const HOST = process.env.GITLAB_HOST || "gitlab.espressif.cn:6688";
const PROJECT = process.env.GITLAB_PROJECT || "app-frameworks/esp-rainmaker-home";

function hasGlab() {
  const r = spawnSync("glab", ["--version"], { stdio: "ignore" });
  return r.status === 0;
}

function isAuthenticated() {
  const r = spawnSync("glab", ["auth", "status"], { stdio: "ignore" });
  return r.status === 0;
}

if (!hasGlab()) {
  console.error("glab CLI not found.\n  Install: brew install glab");
  process.exit(1);
}

if (!isAuthenticated()) {
  console.error(
    `Not authenticated to GitLab.\n  Run: glab auth login --hostname ${HOST}`
  );
  process.exit(1);
}

const out = path.resolve(outArg || name);
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
      out,
    ],
    { stdio: "inherit" }
  );
  console.log(`✓ Wrote ${path.relative(process.cwd(), out) || name}`);
} catch (e) {
  console.error(`Failed to download ${name}: ${e.message || e}`);
  process.exit(1);
}
