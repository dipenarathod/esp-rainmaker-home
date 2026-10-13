#!/usr/bin/env bash
# Print base64 payloads for GitLab/GitHub CI secrets (Android + OTA signing)
# and list the plain-text web deploy variables.
#
# Env files (.env.global / .env.cn / .env.web) are NOT base64 secrets on GitLab:
# upload them as Secure Files with those exact names (Settings → CI/CD →
# Secure Files). The FS_ENV_* entries below are only for the GitHub Actions
# workflow (.github/workflows/release-android-apk.yml), which has no Secure Files.
# Run from repo root: ./scripts/print-ci-secrets-base64.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT}"

# variable_name|relative_path|used_by
# The FS_ prefix on the older entries is an unlabelled project convention
# (~"file secret"); newer entries use a plain descriptive name.
SECRETS=(
  "FS_ENV_GLOBAL_FILE|.env.global|global build (GitHub Actions only)"
  "FS_ENV_CN_FILE|.env.cn|cn build (GitHub Actions only)"
  "FS_KEYSTORE_GLOBAL_FILE|android/app/release.global.keystore|global build"
  "FS_KEYSTORE_CN_FILE|android/app/release.cn.keystore|cn build"
  "FS_GOOGLE_SERVICES_JSON|android/app/google-services.json|global only (GitHub Actions only)"
  "OTA_SIGNING_KEY_PEM|deployment/ota/certs/private-key.pem|ota publish (both platforms)"
)

print_table_header() {
  printf '%-28s | %-42s | %-12s | %s\n' "CI VARIABLE" "SOURCE FILE" "STATUS" "USED BY"
  printf '%-28s-+-%-42s-+-%-12s-+-%s\n' \
    "----------------------------" "------------------------------------------" "------------" "-----------"
}

print_table_row() {
  local name="$1"
  local rel="$2"
  local used_by="$3"
  local status="$4"
  printf '%-28s | %-42s | %-12s | %s\n' "${name}" "${rel}" "${status}" "${used_by}"
}

echo
echo "Android CI secrets"
echo "=================="
print_table_header

missing=0
declare -a READY_SECRETS=()

for entry in "${SECRETS[@]}"; do
  IFS='|' read -r name rel used_by <<< "${entry}"
  path="${ROOT}/${rel}"
  if [ -f "${path}" ]; then
    print_table_row "${name}" "${rel}" "${used_by}" "OK"
    READY_SECRETS+=("${name}|${path}|${used_by}")
  else
    print_table_row "${name}" "${rel}" "${used_by}" "MISSING"
    missing=1
  fi
done

echo
echo "Notes"
echo "-----"
echo "  keystore.properties  → not a CI secret (prebuild writes from .env)"
echo "  FS_ENV_*_FILE        → GitHub Actions only; GitLab reads .env.<flavor> from Secure Files"
echo "  GitLab               → Settings → CI/CD → Variables (masked); env files → Secure Files"
echo "  GitHub               → Settings → Secrets and variables → Actions"
echo

if [ "${missing}" -ne 0 ]; then
  echo "Fix missing files above, then re-run this script."
  exit 1
fi

echo "Base64 payloads (copy value into matching CI variable)"
echo "===================================================="

for entry in "${READY_SECRETS[@]}"; do
  IFS='|' read -r name path used_by <<< "${entry}"
  rel="${path#${ROOT}/}"
  b64="$(base64 < "${path}" | tr -d '\n')"

  echo
  printf '┌%-78s┐\n' "──────────────────────────────────────────────────────────────────────────────"
  printf '│ %-76s │\n' "CI VARIABLE: ${name}"
  printf '│ %-76s │\n' "SOURCE:      ${rel}"
  printf '│ %-76s │\n' "USED BY:     ${used_by}"
  printf '├%-78s┤\n' "──────────────────────────────────────────────────────────────────────────────"
  printf '│ VALUE (base64):                                                              │\n'
  echo "${b64}"
  printf '└%-78s┘\n' "──────────────────────────────────────────────────────────────────────────────"
done

echo
echo "Done. Paste each VALUE into the matching CI variable / GitHub secret."

echo
echo "Web deploy CI variables (plain text — not base64)"
echo "================================================="
echo "  AWS_ACCESS_KEY_ID              → IAM access key or STS temp key"
echo "  AWS_SECRET_ACCESS_KEY          → matching secret"
echo "  AWS_SESSION_TOKEN              → required for STS / SSO session creds"
echo "  AWS_REGION                     → e.g. us-east-1"
echo "  APP_ASSETS_S3_BUCKET          → shared assets bucket (web/ + ota/)"
echo "  CLOUDFRONT_DISTRIBUTION_ID    → CloudFront in front of APP_ASSETS"
echo "  APP_ASSETS_URL                → optional CDN base URL (smoke checks)"
echo "  WEB_DEPLOY_ENV                → optional (default prod; see deployment/web/cdn.yaml)"
echo "  WEB_DEPLOY_REGION             → optional (global|cn; see deployment/web/cdn.yaml)"
echo
echo "Web env file"
echo "============"
echo "  .env.web is not a CI variable. Upload it as a GitLab Secure File named .env.web"
echo "  (Settings → CI/CD → Secure Files). Local devs: npm run env:pull:web"
if [ -f "${ROOT}/.env.web" ]; then
  echo "  Local .env.web: OK"
else
  echo "  Local .env.web: MISSING (npm run env:pull:web, or copy .env.web.example)"
fi
