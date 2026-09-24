#!/usr/bin/env sh
# Detect UI<->server OpenAPI contract drift: fail when the published
# inari-server spec artifact contains paths missing from the pinned
# snapshot at openapi/openapi.yaml. Extra snapshot-only paths (e.g.
# after a downgrade) only warn.
#
# Usage: check-api-drift.sh [spec-ref]
#   spec-ref: OCI tag of ghcr.io/7k-inari/inari-server-openapi (default: edge)
#
# Escape hatches for local testing:
#   DRIFT_IMAGE     - override the OCI image repo (default: canonical artifact)
#   DRIFT_SPEC_FILE - skip oras pull, diff against this local spec file instead
#
# Exit codes: 0 = no drift, 1 = server spec has paths missing from the
# snapshot, 2 = artifact could not be pulled/read.
set -eu

REF="${1:-edge}"
IMAGE="${DRIFT_IMAGE:-ghcr.io/7k-inari/inari-server-openapi}:${REF}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SNAPSHOT="$ROOT/openapi/openapi.yaml"

paths() {
  if [ ! -f "$1" ]; then
    echo "::error::spec file not found: $1" >&2
    exit 2
  fi
  if ! yq '.paths | keys | .[]' "$1" > "$WORK/paths.tmp"; then
    echo "::error::failed to parse paths from $1 (yq error)" >&2
    exit 2
  fi
  sort "$WORK/paths.tmp"
}

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT

if [ -n "${DRIFT_SPEC_FILE:-}" ]; then
  SERVER_SPEC="$DRIFT_SPEC_FILE"
else
  if ! (cd "$WORK" && oras pull "$IMAGE") >/dev/null 2>&1; then
    echo "::error::could not pull $IMAGE — artifact missing or unreachable."
    echo "The :edge spec is published by inari-server's edge pipeline; released"
    echo "versions are published by its release pipeline. Check the tag exists."
    exit 2
  fi
  # Artifact layout is dist/openapi.yaml (older releases shipped it at the root).
  if [ -f "$WORK/dist/openapi.yaml" ]; then
    SERVER_SPEC="$WORK/dist/openapi.yaml"
  else
    SERVER_SPEC="$WORK/openapi.yaml"
  fi
fi

paths "$SERVER_SPEC" > "$WORK/server.paths"
paths "$SNAPSHOT" > "$WORK/snapshot.paths"

MISSING="$(comm -23 "$WORK/server.paths" "$WORK/snapshot.paths")"
EXTRA="$(comm -13 "$WORK/server.paths" "$WORK/snapshot.paths")"

if [ -n "$MISSING" ]; then
  echo "::error::API drift: $IMAGE exposes paths missing from openapi/openapi.yaml:"
  echo "$MISSING" | sed 's/^/  /'
  echo "Fix: npm run sync:api -- <server-version> and commit openapi/openapi.yaml +"
  echo "src/api/__generated__/schema.ts (use a released server version, not edge,"
  echo "before releasing the UI)."
  exit 1
fi

if [ -n "$EXTRA" ]; then
  echo "::warning::snapshot has paths not present in $IMAGE (server downgrade or removed endpoints):"
  echo "$EXTRA" | sed 's/^/  /'
fi

echo "no drift: openapi/openapi.yaml covers every path in $IMAGE"
