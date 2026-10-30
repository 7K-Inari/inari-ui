# M5W2 — UI resources view for native CRs and KRO — Design Index

- **Task**: `[M5W2] UI resources view for native CRs and KRO` (Kandev: 080c085a-50d8-4be2-b927-e1d20cd1e6c4, design phase)
- **Parent plan**: Inari operator future role — assessment and target architecture (Kandev: b6969b1e-663f-4d16-a3b2-920612b16270, §4 RES+ADDONS UI block, §6 inari-ui impact map)
- **Penpot mode**: MODE B — remote (`penpot-remote` MCP, plugin at penpot.7kgroup.org)
- **Penpot file**: [Inari Console](https://penpot.7kgroup.org/workspace/58349be9-a075-8103-8008-ccc4498f00ba) — project `inari-ui`, file `Inari Console` (id `58349be9-a075-8103-8008-ccc4498f00ba`)
- **Shared library**: `7K Design System` (connected, id `12a76929-1c9e-81ad-8008-ca822821d110`) — no library items edited (one DS gap recorded below)
- **Project accent**: Inari burnt orange `--inari-500: #EE560D` (accent text/links only; no status-color overrides)
- **Surface**: Product dashboard (DESIGN.md §5–7 rules); dark theme only
- **DS breakpoints**: 1440px boards (all boards in this file are 1440 wide; see "390px behavior" below)
- **Code draft validated**: branch commit `eb1f5a6` (`src/pages/resources/platform-resources-section.tsx`, `resource-list.tsx`, `src/pages/platform/platform-page.tsx`) — treated as draft; this index is the design source of truth for the implementation pass. No feature code was written in this phase.

> **Component usage**: All boards use the local `Inari / Shell` component (Topbar+Sidebar). Badges are DS `badge / default` instances (Tone neutral/success/warning/danger, Theme dark) with per-instance dark-status color overrides (see DS-gap G1). Cards, tables, skeletons, section labels are raw shapes styled from DS tokens, matching the existing Resources/Addons boards (no DS `table` component equivalent in use on this file's screens).

---

## Board manifest (TOUCHED ARTIFACTS)

All boards are in the existing `Inari Console` file — no new per-task file was created. Page: `screens / operate` (id `e8f72436-db5f-8060-8008-d5df6d58aa52`) unless noted. Deep link base: `https://penpot.7kgroup.org/workspace/58349be9-a075-8103-8008-ccc4498f00ba?page-id=<page-id>`.

| # | Board | Board ID | State | What changed |
|---|-------|----------|-------|--------------|
| 1 | `resources` | `f86a119d-5cf8-800f-8008-d5e3083a9aa7` | FINAL | New PLATFORM RESOURCES section inserted above the existing deployed-instances table; page description added; DEPLOYED INSTANCES section label added; board height 896→1000 |
| 2 | `resources--platform-loading` (new) | `38ccdc29-f197-8029-8008-de7f40b642e2` | FINAL | Full page; platform section in loading state (skeleton rows) |
| 3 | `resources--platform-empty` (new) | `38ccdc29-f197-8029-8008-de7f45bf49cb` | FINAL | Full page; platform section in empty state |
| 4 | `resources--platform-error` (new) | `38ccdc29-f197-8029-8008-de7f4ac48235` | FINAL | Full page; platform section in error state |
| 5 | `resources--loading` | `f86a119d-5cf8-800f-8008-d5e3083a9aae` | FINAL | Rebuilt: populated platform section + deployed instances in loading state (was stale single-section page) |
| 6 | `resources--empty` | `f86a119d-5cf8-800f-8008-d5e3083a9aaf` | FINAL | Rebuilt: populated platform section + deployed instances empty card with Browse catalog CTA |
| 7 | `resources--error` | `f86a119d-5cf8-800f-8008-d5e3083a9ab0` | FINAL | Rebuilt: populated platform section + deployed instances error card |
| 8 | `platform` (page `screens / govern`, id `e8f72436-db5f-8060-8008-d5df6d595198`) | `f86a119d-5cf8-800f-8008-d5e2017c1143` | FINAL | Module stats row and 9 module cards replaced by 3 PLATFORM CLUSTER APPS cards + tenant-platform-resources pointer card; page description added |

Non-board artifacts touched:
- **Page `index` → `SCREEN INDEX` board** (`f86a119d-5cf8-800f-8008-d5e61443babc`, page id `e8f72436-db5f-8060-8008-d5df6d56539d`): operate line updated to 25 boards.
- **Page `Read me`** (id `01748e06-6db4-80d1-8008-cceea297ad60`): M5W2 entry appended (rework summary + badge dark-tone gap note).
- **DS library**: none (gap G1 recorded instead of forking).

Board state markers: all 8 touched boards carry the file's standard FINAL marker — a 40×16 pill `#00E676` named `state-marker` 8px above the board's top-right corner (board.x+1392, board.y−8) plus a 9px Geist Mono black `FINAL` label (marked FINAL on user approval, 2026-10-30). Pills are the only page-level orphans by convention; every screen's content lives inside its board (verified: 0 non-marker orphans on both touched pages).

Cluster Addons boards (`cluster-addons*`, M3W2) were audited for the wiring (row-level "external-dns addon" link target + section-level "Addons page" link) and intentionally left untouched.

---

## Screen 1: Resources view — `resources` (`/:tenant/deploys`)

Deep link: `…?page-id=e8f72436-db5f-8060-8008-d5df6d58aa52` (board `resources`)

### Layout (board-relative coords, content x=266, width=1150, board 1440×1000)

| Zone | y | Content |
|------|---|---------|
| Breadcrumb | 80 | `OPERATE / RESOURCES` — Geist Mono 11/500, ls 1.32, `--text-tertiary` #82828A |
| Page title | 104 | `Resources` — Geist 24/400, `--text-primary` #FAFAFB |
| Page description | 140 | Geist 13/400, #82828A, single line |
| Section label | 194 | `PLATFORM RESOURCES` — Geist Mono 11/500, ls 1.32, #82828A |
| Section link (right) | 194 | `ADDONS PAGE →` — Geist Mono 11/500, ls 1.32, `--inari-500` #EE560D; right edge at content edge (x 1303→1416); links to tenant clusters list |
| Section description | 216 | Geist 13/400, #82828A, 2 lines (width 1150): "Native cert-manager ClusterIssuers, ExternalDNS DNSEndpoints, ArgoCD AppProjects, and KRO tenantnamespace instances rendered into this tenant's GitOps state repos and synced by ArgoCD." |
| Platform table card | 268 | 1150×322, fill #141419, 2px stroke #26262B, radius 8 |
| Table header | 288 | labels Geist Mono 9/500, ls 1, #82828A; header separator 2px #1C1C22 at y=310 |
| Rows | 310–590 | 5 rows × 56px, row separators 2px #1C1C22 between rows |
| Instances section label | 614 | `DEPLOYED INSTANCES` — Geist Mono 11/500, ls 1.32, #82828A |
| Filter row | 648 | unchanged legacy content (search input, ALL CLUSTERS select, ALL/DRIFTING/DEGRADED/PROGRESSING pills) |
| Instances table | 720 | unchanged legacy 1150×276 card (NAME/KIND/CLUSTER/VERSION/DRIFT/STATUS/ACTIONS) |

### Platform resources table columns (x offsets from card left edge 266)

| Column | x | Content |
|--------|---|---------|
| KIND | 294 | DS `badge / default` neutral, dark-override (G1) — kind label, uppercase |
| NAME | 500 | Geist Mono 12/100, #FAFAFB — plain text (no detail page exists) |
| STATUS | 736 | DS badge success/warning/danger — `Ready`/`Reconciling`/`Failed` |
| DETAIL | 950 | Geist Mono 12/100; `—` (#82828A) when empty; body copy #B0B0B8; failure detail #FF5C7A |
| MANAGED BY | 1158 | addon rows: Geist Mono 12/500 #EE560D link `{addon} addon` → tenant clusters list; KRO/platform rows: Geist Mono 12/100 #82828A (`KRO tenantnamespace` / `Platform hub`); unknown kinds: `—` |
| UPDATED | 1336 | Geist Mono 11/500, #82828A relative time (`2m ago`) |

### Canonical rows (5 — covers all kinds, all statuses, unknown-kind degradation)

| KIND badge | NAME | STATUS | DETAIL | MANAGED BY | UPDATED |
|------------|------|--------|--------|------------|---------|
| DNSEndpoint | acme-apps.example.com | Ready | — | external-dns addon (link) | 2m ago |
| Tenant namespace | acme-inc | Ready | — | KRO tenantnamespace | 1h ago |
| Keycloak realm | acme-inc | Ready | — | Platform hub | 1h ago |
| Keycloak client | console | Reconciling | awaiting provider claim | Platform hub | 5m ago |
| acme-cdn-endpoint (raw unknown kind) | cdn-acme | Failed | endpoint CRD not installed | — | 3d ago |

Kind labels map 1:1 to `platformResourceKindInfo` in `src/api/platform.ts`. Unknown kinds render the raw `kind` string in a neutral badge with `—` managed-by (row 5 is the spec for degradation).

### Badge specs (DS `badge / default` instances, 1px inner stroke, flex pad 4/8, h=21, text Geist Mono 11/600 ls 0.88 uppercase)

| Tone | Fill (bg token) | Stroke | Text |
|------|-----------------|--------|------|
| neutral | #1C1C22 (`--neutral-900`/`--status-neutral-bg`) | #82828A (`--status-neutral`) | #B0B0B8 (`--status-neutral-fg`) |
| success | #002915 (`--success-950`) | #00E676 (`--status-success`) | #5CE69A (`--status-success-fg`) |
| warning | #332400 (`--warning-950`) | #FFB300 (`--status-warning`) | #FFCE5C (`--status-warning-fg`) |
| danger | #330A10 (`--danger-950`) | #FF3B5C (`--status-danger`) | #FF5C7A (`--status-danger-fg`) |

Badge width = text width + 17px (8+8 horizontal padding + 1 stroke); width is fixed per label, not fluid.

### States (each section loads independently — page chrome always renders)

| State | Board | Spec |
|-------|-------|------|
| Platform loading | `resources--platform-loading` | Board 1440×1000 (skeleton footprint mirrors the populated table). Card 1150×322 (same geometry as populated); 5 skeleton bars 640×20, fill #1C1C22, radius 4, at row centers (y=328+56k); deployed block at the same y as the main board (label 614, filter row 648, table 720) |
| Platform empty | `resources--platform-empty` | Board 1440×896 — sections flow 24px apart (no pinned gap): card 1150×168 (268–436); title `No platform resources yet` Geist 16/400 #FAFAFB (306,304); body Geist 13/400 #82828A (306,336): "Resources appear here as the platform renders them into this tenant's GitOps state repos — DNS endpoints, tenant namespaces, and Keycloak realms/clients." No CTA (nothing to browse). Deployed label y=460, filter row y=494, instances table y=566–842 |
| Platform error | `resources--platform-error` | Board 1440×896, same flowing layout: card 1150×96 (268–364); `Failed to load platform resources: timeout` Geist 13/400 #FF5C7A (306,296). No retry button — matches file convention (see decision D4). Deployed label y=388, filter row y=422, instances table y=494–770 |
| Instances loading / empty / error | `resources--loading` / `-empty` / `-error` | Same page with populated platform section; deployed section shows skeleton card + `Loading resources…`, empty card + `Browse catalog` CTA (→ catalog), or `Failed to load resources: timeout` error card (1150×96/174/276, same card style). Heights: `--loading` 1440×1000 (skeleton footprint matches the table), `--empty`/`--error` 1440×896 with the deployed block following the platform table 24px below |
| All tenants | — (no board) | Section is not rendered at all when the tenant context is All tenants (API is tenant-scoped). No placeholder. |
| Unknown kind | row 5 of `resources` | Raw kind string, neutral badge, `—` managed-by, status badge falls back to neutral for unrecognized status strings |

---

## Screen 2: Platform page — `platform` (`/:tenant/platform`)

Deep link: `…?page-id=e8f72436-db5f-8060-8008-d5df6d595198` (board `platform`)

### Layout (board-relative, content x=266, board 1440×896)

| Zone | y | Content |
|------|---|---------|
| Breadcrumb | 80 | `GOVERN / PLATFORM` (+ back chevron) |
| Page title | 104 | `Platform` — Geist 24/400 #FAFAFB |
| Page description | 140 | "Apps running on the platform cluster and the platform resources rendered for this tenant." — Geist 13/400 #82828A |
| Section label | 188 | `PLATFORM CLUSTER APPS` — Geist Mono 11/500 ls 1.32 #82828A |
| App cards | 212 | 3 cards 367×104 (grid 3-up, gap 24; fill #141419, 2px #26262B, radius 8): name Geist (sans, inherits legacy card title ~16/400) #FAFAFB; version Geist Mono 12/500 #B0B0B8; description Geist 12/400 #82828A, 2 lines, width 335 |
| Pointer card | 340 | 1150×124, same card style; title `Tenant platform resources` Geist 16/400 #FAFAFB (306,364); link `RESOURCES VIEW →` Geist Mono 11/500 ls 1.32 #EE560D, right-aligned (x 1273, y 368) → tenant Resources view; body Geist 13/400 #82828A (306,396, w 1070, 2 lines) |

Card copy: `inari-server v1.8.2`, `agent-gateway v1.12.0`, `inari-console v1.3.0` (representative catalog items, `source=platform`).

---

## Design-to-code mapping

Repo stack: React + TypeScript + Tailwind + `7k-design-system/react` (`Badge`, `Card`, `DataTable`, `Button`) with DS CSS variables. The draft implementation (`eb1f5a6`) already uses these; the maps below pin the design values.

| Design token (Penpot) | Value | Code |
|-----------------------|-------|------|
| Surface / card fill | #141419 (file table/card convention) | `Card` / `DataTable` surfaces (DS `--bg-elevated` #131318 is the nearest role token; the file's existing tables use #141419 — keep the code's existing `.card`/DataTable styling, do not introduce a new value) |
| Card stroke | #26262B 2px inner, radius 8 | existing card classes (`--border-default` ramp `--neutral-800`) |
| Row separators | #1C1C22 2px | `--neutral-900` / existing table divider styling |
| Text primary | #FAFAFB | `--text-primary` |
| Text secondary | #B0B0B8 | `--text-secondary` |
| Text tertiary / muted | #82828A | `--text-tertiary` |
| Accent (links, managed-by) | #EE560D | `--inari-500` / `--accent-inari` (project scope `data-project='inari'`); link style: Geist Mono 12/500 |
| Status fg/bg | #5CE69A/#002915, #FFCE5C/#332400, #FF5C7A/#330A10 | `--status-{success,warning,danger}-{fg,bg}` (dark theme) |
| Danger text | #FF5C7A | `--status-danger-fg` |
| Section labels | Geist Mono 11/500, ls 0.12em, uppercase | `.mono-label` / `--text-mono-label` |
| Table header | Geist Mono 9→use 11px token scale, ls 1px, uppercase, #82828A | `--text-mono-label` + `--text-tertiary` |
| Row text | Geist Mono 12 (thin) | `--font-mono`, tabular data |
| Badges | DS `Badge` (`badge / default`) Tone variants | `<Badge variant="neutral|success|warning|danger">`; **G1**: apply dark-status token values via the DS dark theme — if the DS badge still renders light fills in dark mode, fix at DS source, do not hand-style per instance in product code |

Data contract respected: rows are `{id, tenant, kind, name, status, detail, updatedAt}`; kinds `keycloak-realm|keycloak-client|dns-zone|tenant-namespace`; statuses `ready|reconciling|failed`; `kind`/`status` are plain strings — always fall back (raw kind string / neutral status badge). View is tenant-scoped.

---

## Accessibility notes

- Status is never communicated by color alone: status column uses a text badge (`Ready`/`Reconciling`/`Failed`), not a dot; the legacy deployed-instances dot+text pattern is unchanged.
- Contrast (dark theme): #FAFAFB, #B0B0B8, #FFCE5C, #5CE69A, #FF5C7A, #EE560D on #0A0A0D/#141419 all pass WCAG AA (≥4.5:1); #82828A on #0A0A0D ≈ 4.9:1 — used for metadata/labels only.
- Loading uses skeleton shapes (reduced-motion: no ambient animation in app-shell content per DS §7); empty/error states are text-based and screen-reader accessible via the existing section `aria-label`s.
- The "ADDONS PAGE →" / "RESOURCES VIEW →" links and row-level `{addon} addon` links have ≥24px tap height via the existing `-my-1 py-1` inline-link pattern (see commit 7566884).

## 390px behavior

All boards are 1440px, per this file's convention (every screen board is 1440; M1W2 precedent). The console shell has no 390px variant in the DS/Inari file (gap G2). Spec for a 390px viewport (documented, not drawn): page padding 16px; sections stack vertically (platform section first); each table scrolls horizontally with the first two columns (KIND, NAME) pinned; filter pills wrap; section-level links move below the section label. Treat as a follow-up if mobile console use becomes a requirement.

## Key decisions

- **D1 IA validated (user-confirmed)**: platform-resources section lives on the Resources view above deployed instances; Platform page becomes a slim pointer. Rationale: matches parent plan §4 (RES+ADDONS block) and the draft; Resources is where tenant-scoped desired state is surveyed, Addons remains the management surface on clusters.
- **D2 Managed-by wiring (user-confirmed option a)**: row-level addon links point at the tenant clusters list (`/{tenant}/clusters`), not a specific cluster's Addons page — rows carry no cluster field, so a direct link is impossible without an API addition. Improvement recorded as gap G3. KRO/platform rows are plain muted text (no destination page exists for them).
- **D3 Kind/status presentation**: kinds are neutral badges with the mapped native label (`DNSEndpoint`, `Tenant namespace`, `Keycloak realm`, `Keycloak client` — from `platformResourceKindInfo`), statuses are tone badges. Badges read as schematic metadata (mono, uppercase) and degrade to the raw string for unknown kinds.
- **D4 No retry on error cards**: matches the file's existing error-state convention (message only). Retry can be added later across all sections at once.
- **D5 Old page-level state boards rebuilt**: `resources--loading/--empty/--error` previously depicted the pre-rework single-table page; they now show the two-section page with the deployed-instances section in the respective state, so the file stays a single source of truth. Platform-section states got their own `resources--platform-*` boards because the two sections load independently.
- **D6 Section descriptions shortened** vs the draft copy (mention of cert-manager ClusterIssuers/ArgoCD AppProjects kept, "The backing addons are managed from a cluster's Addons page" moved out of the paragraph into the dedicated `ADDONS PAGE →` link to avoid mid-sentence link wrapping).

## DS gaps / TODOs

- **G1 (badge dark tones)**: DS library `badge / default` Theme=dark variants carry light-theme fills (e.g. success `#b8f5d2` bg / `#008a46` text instead of dark `#002915`/`#5CE69A`). DESIGN.md §2 status tokens define the dark values; the Penpot main instances don't match. **Proposal**: fix the four status + neutral dark variants in the `7k-design-system` file to the `--status-*-bg/fg` dark values (success #002915/#5CE69A, warning #332400/#FFCE5C, danger #330A10/#FF5C7A, neutral #1C1C22/#B0B0B8). Until then, Penpot instances in this file carry manual overrides (documented on the file's Read me page); product code should use the DS dark theme, not per-instance hex.
- **G2 (390px shell)**: no mobile variant of the Inari `Shell`/sidebar in the DS or this file. **Proposal**: add a 390px shell (top bar + bottom tab nav per DS mobile rules) to the Inari local library before designing mobile screens.
- **G3 (managed-by target)**: platform-resources API rows have no cluster field, so addon-backed rows can only link to the clusters list. **Proposal (API, not DS)**: add optional `management.clusterId` to the platform-resources row so the UI can deep-link to `/{tenant}/clusters/{id}/addons`; until then keep the clusters-list link.
