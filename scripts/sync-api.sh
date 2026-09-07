#!/usr/bin/env sh
# Refresh the pinned inari-server OpenAPI snapshot (openapi/openapi.yaml)
# from the published OCI artifact, then regenerate the TypeScript types.
#
# Usage: npm run sync:api -- <server-version>   (e.g. 1.3.1)
#
# The artifact is published by inari-server's release pipeline:
#   ghcr.io/7k-inari/inari-server-openapi:<version>
set -eu

VERSION="${1:?usage: sync-api.sh <server-version> (e.g. 1.3.1)}"
IMAGE="ghcr.io/7k-inari/inari-server-openapi:${VERSION}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

cd "$(mktemp -d)"
oras pull "$IMAGE"
cp openapi.yaml "$ROOT/openapi/openapi.yaml"

cd "$ROOT"
npm run codegen
echo "synced $IMAGE -> openapi/openapi.yaml + src/api/__generated__/schema.ts"
