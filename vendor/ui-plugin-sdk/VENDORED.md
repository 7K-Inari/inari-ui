# Vendored @inari/ui-plugin-sdk

Source: https://github.com/7K-Inari/inari-ui-plugin-sdk @ main (commit d2dda72, post-M4-W1 merge, package version 0.1.1).

Why vendored: the package is not published to npm and the git dependency ships
no `dist/` (its `files` allowlist excludes `src/`, and `tsup` is unavailable in
our offline npm cache to build it). We therefore vendor the contract source and
alias `@inari/ui-plugin-sdk` to `vendor/ui-plugin-sdk/src/index.ts` in
vite.config.ts, vitest.config.ts, and tsconfig.json.

Test files were excluded. Replace with the published npm package when available.
