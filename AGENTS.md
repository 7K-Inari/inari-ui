# inari-ui — Agent Guide

Web console for Inari: host shell + all first-party pages, design system, schema-form renderer (plan §6 #4, §8).

Stack: React, TypeScript, Vite, Tailwind, shadcn/ui, RJSF, Module Federation

## Key architecture constraints
- **Module Federation host**: first-party pages are internal remotes on the same SDK as third-party extensions; the shell only composes (§8.1).
- **Schema-driven forms everywhere**: deploy wizard walks OpenAPI v3 schemas (RJSF) + OLM/KubeVela UI hints + platform policy (locked fields, defaults) (§8.1).
- Tenant context switcher is first-class chrome; multi-org users get a global "All tenants" home, fast switcher with recents, strict per-org scoping, deep links carry tenant context (§8.1, §11/6).
- Auth: OIDC against platform Keycloak `inari` realm (organization scope; per-service audiences) (§5.4).
- Static bundle, served by inari-server (§6).
- IA/navigation and v1 screen build order: plan §8.2–8.3; extension slots: §8.4.

## Conventions
- Conventional Commits; SemVer releases; console bundle OCI artifacts cosign-signed.
- Release flow (release-please, PR-only mode):
  1. `fix:`/`feat:` merges to `main` → `.github/workflows/release-please.yml` opens/updates a Release PR (package.json bump + CHANGELOG.md). Nothing else happens — no tags, Releases, or publishes. The action MUST run in manifest mode (pass `config-file`/`manifest-file`, never `release-type` — that silently drops `release-please-config.json`, so `extra-files` sync never lands).
  2. A maintainer manually merges the Release PR (human gate). CI lint/test/build checks must pass on the PR.
  3. `.github/workflows/release.yml` — the sole release-please detector on push to `main` — detects the release merge, creates+pushes tag `vX.Y.Z`, creates the GitHub Release, then invokes the reusable pipelines (never tag-push triggered; the tag is pushed with GITHUB_TOKEN):
     - `.github/workflows/publish.yml` (`workflow_call`): console bundle pushed as OCI artifact `ghcr.io/7k-inari/inari-ui-bundle` (consumed by `inari-server` when building its image), cosign keyless sign, SBOM + SLSA provenance.
     - `.github/workflows/chart-publish.yml` (`workflow_call`, one matrix leg per released `charts/` path): chart pushed to `oci://ghcr.io/7k-inari/inari-ui/charts`.
     - Only one workflow may run release-please detection per push: two detectors race (the second sees the release already created and gets empty outputs), which silently skips publishes.
     - Repair path: `release.yml` accepts a `workflow_dispatch` with a version to re-publish an already-tagged release whose publishes failed/skipped.
- Write tests for new behavior; keep changes minimal and focused.
- Helm chart `charts/inari-console` (moved from inari-helm-charts): independent release-please `simple` component (tags `inari-console-vX.Y.Z`), published to `oci://ghcr.io/7k-inari/inari-ui/charts` by `chart-publish.yml` (invoked from `release.yml`; `chart-release.yaml` is the manual `workflow_dispatch` repair path). Never bump `version:` by hand; `appVersion` and `values.yaml` `bundle.tag` are auto-synced to the UI release via the root component's `extra-files`. CI lints (`helm lint`, `ct lint`) and runs helm-unittest.
- Canonical architecture & development plan: https://github.com/7K-Inari/inari-docs/blob/main/docs/architecture/inari-platform-plan.md (section references below point into it).

## Platform design principles (apply everywhere)
1. Tenant-aware to the core — every object carries a tenant ID; every API decision is tenant-scoped.
2. Zero tenant credentials on the hub — no tenant kubeconfigs or cloud keys in the control plane.
3. Pull, never push — agents dial out; the control plane never initiates connections into tenant networks.
4. Desired state, eventually reconciled — GitOps/CR-based mutations, not imperative RPCs.
5. The catalog is a projection of reality — capabilities are discovered, not declared.
6. Small kernel, everything else extension.
7. Modular monolith first — strict internal module boundaries.
