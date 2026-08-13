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
- Conventional Commits; SemVer releases; container images/artifacts cosign-signed (once CI exists).
- Write tests for new behavior; keep changes minimal and focused.
- Canonical architecture & development plan: https://github.com/7K-Inari/inari-docs/blob/main/docs/architecture/inari-platform-plan.md (section references below point into it).

## Platform design principles (apply everywhere)
1. Tenant-aware to the core — every object carries a tenant ID; every API decision is tenant-scoped.
2. Zero tenant credentials on the hub — no tenant kubeconfigs or cloud keys in the control plane.
3. Pull, never push — agents dial out; the control plane never initiates connections into tenant networks.
4. Desired state, eventually reconciled — GitOps/CR-based mutations, not imperative RPCs.
5. The catalog is a projection of reality — capabilities are discovered, not declared.
6. Small kernel, everything else extension.
7. Modular monolith first — strict internal module boundaries.
