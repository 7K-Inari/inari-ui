#!/usr/bin/env bash
# push-oci-bundle.sh — push the console bundle tarball as an ORAS OCI
# artifact with a minimal, valid OCI image config.
#
# Usage: push-oci-bundle.sh <image:tag>
#   <image:tag>  full registry ref to push (one tag per invocation)
#
# Why the --config: Harbor derives an artifact's Type from the manifest's
# config media type. A bare `oras push` of the tarball leaves the config at
# application/vnd.oci.empty.v1+json, so Harbor classifies the bundle as
# Type=UNKNOWN and its scan gate (Type=IMAGE only) rejects every Trivy
# scan. Pushing with a config of media type
# application/vnd.oci.image.config.v1+json makes the bundle Type=IMAGE and
# scannable. The custom layer media type is unchanged — the console chart's
# init-container (`oras pull` + untar) and inari-server pull the layer by
# name; oras pull skips the untitled config blob, so both consumers are
# unaffected. artifactType stays unset: inari-server's oci fetcher treats an
# empty artifactType as the legacy path.
#
# The config body is a minimal valid OCI image config. rootfs.diff_ids
# references the *uncompressed* tar digest so Trivy can map layers
# deterministically; empty architecture/os are valid for a non-runnable
# static-asset artifact.
#
# Requires: oras, gzip, sha256sum; inari-ui-bundle.tar.gz in the CWD.
# oras's stdout is passed through verbatim — publish.yml parses the pushed
# manifest digest from it.
set -euo pipefail

ref="${1:?usage: push-oci-bundle.sh <image:tag>}"

BUNDLE_TARBALL="inari-ui-bundle.tar.gz"
LAYER_MEDIA_TYPE="application/vnd.inari.ui.bundle.v1.tar+gzip"
CONFIG_MEDIA_TYPE="application/vnd.oci.image.config.v1+json"

if [ ! -f "${BUNDLE_TARBALL}" ]; then
  echo "push-oci-bundle: ${BUNDLE_TARBALL} not found in $(pwd) — build and package the bundle first" >&2
  exit 1
fi

diff_id="sha256:$(gzip -dc "${BUNDLE_TARBALL}" | sha256sum | cut -d' ' -f1)"
created="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

config_file="$(mktemp)"
trap 'rm -f "${config_file}"' EXIT

printf '{"architecture":"","os":"","created":"%s","config":{},"rootfs":{"type":"layers","diff_ids":["%s"]}}' \
  "${created}" "${diff_id}" > "${config_file}"

oras push "${ref}" \
  --config "${config_file}:${CONFIG_MEDIA_TYPE}" \
  "${BUNDLE_TARBALL}:${LAYER_MEDIA_TYPE}"
