# Inari UI/UX Rework — Design Direction & Screen Specs

- **Scope**: `inari-ui` (host console) + `inari-ext-argocd/ui` (extension surfaces)
- **Foundation**: `7k-design-system@1.2.0` (local checkout `7k-design-system/`, built to `dist/7k-design-system.css`; 1.2.0 is the "modernize" release — Inari ramp, accent-driven project scoping, modern button language, new Spinner/Skeleton/Avatar/Progress/Listbox/ProjectIcon React components)
- **Surface**: Product dashboard (DESIGN.md §5–7 rules)
- **Project accent**: Inari — burnt orange `--inari-500: #EE560D` via `<html data-project="inari">` / `ProjectProvider defaultProject="inari"`
- **Status of this document**: Design-review draft. No feature code has been written.

---

## 1. UI Audit — current state

### 1.1 Inventory of screens

| Area | Screens (current) | Notes |
|---|---|---|
| Shell | `AppShell`, `Sidebar`, `Header`, `TenantSwitcher` | Sidebar 256px, 4 nav sections (Deliver / Operate / Govern), header with tenant switcher, theme toggle, user menu |
| Overview | `overview-page`, `all-tenants-home` (+ `tenant-strip`, per-card components) | Card grid 2-up, all cards visually equal weight; all-tenants home stacks per-tenant strips |
| Catalog | `catalog-browse`, `catalog-item-detail`, `deploy-wizard` | Filter bar (search/source/category/cluster/sort/view), grid/list, 3-step wizard |
| Deliver | `templates/template-list`, `templates/scaffold-wizard`, `approvals/approvals-page` | Inbox/requested toggle, modal decision with mandatory reason |
| Operate | `clusters/cluster-list`, `cluster-detail` (+connect tab, register wizard, kubectl card), `fleet/*`, `cloud-accounts/*`, `zones/*` | Status filter button row (9 statuses), 15s polling |
| Govern | `platform`, `access/*` (members/roles/role-matrix/feature-flags), `audit-log`, `extensions`, `settings/*` | Settings has its own sub-nav |
| Resources | `resources/resource-list`, `resource-detail`, `upgrade-flow` | Per-cluster resources, drift status, version upgrades |
| Zones | `zones/zone-list`, `zone-detail`, `vend-wizard` | Tenant zones; vend wizard provisions a zone |
| Cloud accounts | `cloud-accounts/cloud-account-list`, `cloud-account-detail`, `connect-wizard` | Status badges, connect wizard |
| Organizations | `organizations/create-organization` | Org onboarding flow |
| Extensions | `extensions-page` | UI + backend extension lists |
| ext-argocd | `ClusterTab` (ArgoCD health per instance), `CatalogCard` (GitOps badge), `InstanceActions` | **Unstyled**: inline styles, hardcoded GitHub-green/amber/red hexes, pill radius 10 |

### 1.2 Problems found

**Visual language**
1. The console is a generic shadcn/Tailwind theme (light-first warm-grey palette, 0.5rem radius, soft shadows). It has **no brand identity** and does not use the 7k design system at all.
2. Accent color is an HSL warm brown (`24 95% 30%`) that is *similar to but not* the Inari burnt-orange brand ramp (`--inari-500 #EE560D`); status colors are ad-hoc Tailwind defaults.
3. Mixed geometry: rounded cards/buttons + `rounded-full` step indicators + squared tables — no coherent 1-bit zero-radius language.
4. Typography is all Geist sans; no mono "connective tissue" for labels/tabular data, no type hierarchy beyond `text-2xl semibold` page titles.

**Layout / IA**
5. Page headers are inconsistent: some pages have title+description+action, others (catalog browse) push actions into a crowded filter bar; the description line is noise on every page ("Tenant x: cluster health…").
6. Overview page is a flat 2-column grid of six visually identical cards — no priority, no stat summary, approvals and quick-actions buried at equal weight.
7. Cluster list's 9-button status filter row wraps badly and duplicates a dropdown pattern used elsewhere (catalog). No count badges; "no match" and "empty" are different cards with different styling.
8. Filter state lives in URL on catalog (good) but in local state on clusters/approvals (bad — deep links lost). Pattern is not uniform.
9. Sidebar sections (Deliver/Operate/Govern) are a reasonable IA but visually undifferentiated; no active-section indication, no collapse, no badge counts (e.g. pending approvals).
10. Mobile: sidebar becomes a sheet, but tables and wizard steps don't reflow; the tenant switcher stays `w-56` and crowds the header.

**Component / UX behavior**
11. Destructive actions use `window.confirm` (cluster cancel) while approvals use a styled modal — two different dialog patterns.
12. Loading states are plain text ("Loading clusters…") or nothing; no skeletons. Errors are inline red text in a card, no retry CTA in most places.
13. Extension UI (ext-argocd) uses hardcoded inline-style pills with GitHub palette colors; health colors are duplicated per file and inconsistent with console status colors.
14. The deploy wizard stepper uses arrow separators and circles; not a DS stepper, no completion states.
15. Empty states are plain paragraphs inside bordered cards — no illustration language, no next-action hierarchy.
16. **Resources, Zones, Cloud Accounts, Organizations are entirely un-audited surfaces**: they reuse ad-hoc status badges (`cloud-accounts/status-badge.tsx` hardcodes its own hues) and table layouts without a uniform filter/state pattern.
17. **All-tenants home** stacks per-tenant summary strips as equal-weight cards — a multi-org user gets no aggregate "what needs me across orgs" answer; pending approvals across tenants are not surfaced.

### 1.3 What stays

- Information architecture (Deliver / Operate / Govern grouping, tenant scoping, route structure) is sound and is **kept**; this rework is a visual/UX-layer replacement, not a re-IA.
- URL-driven filter state on catalog is kept and generalized.
- Extension slot architecture (Module Federation) is kept; only the visual rendering of slot content changes.

---

## 2. Design direction

**"Control room, not admin panel."** Inari is a fleet control plane; the UI should read like an engineering blueprint: dark near-black canvas, burnt-orange accent used thinly and precisely, mono labels as connective tissue, tabular numerics for every metric, zero-radius 1-bit components with 2px borders and invert-on-hover.

Three principles:
1. **Status first** — every screen answers "is anything on fire?" within one glance: status-colored accents, count badges in nav, stat row at top of list pages.
2. **Thin accent** — orange (#EE560D) appears on primary actions, focus rings, active nav, active tab underlines, and 3px edge accents. Never as a surface fill.
3. **Mono metadata** — every label, badge, breadcrumb, table header, timestamp is Geist Mono 11px uppercase 0.12em; data is Geist Mono tabular-nums.

Theme: **dark is the default** (`--bg-void #000000` page canvas, `--bg-base #0A0A0D` surfaces). Light theme remains available via `ThemeToggle` (DS supports it); design specs below use dark values, light is the DS's mapped equivalents and needs no separate layout work.

Accent scoping: the host app renders under `<html data-project="inari">` (or `ProjectProvider project="inari"`), so the entire `--brand-primary`/`--brand-secondary` chain resolves to the Inari ramp: `--brand-primary: var(--inari-500) #EE560D`, hover `#E56F3F`? — exact values: 500 `#EE560D`, hover 400 `#E56F3F`, active 600 `#C44813`, muted 800 `#8B310D`, subtle 950, glow `color-mix(in srgb, #EE560D 25%, transparent)`.

### 2.1 Global layout system

**App shell (≥1024px)**

```
┌────────────────────────────────────────────────────────────┐
│ Top bar: 56px, sticky, bg-base, border-b 2px border-subtle │
│  [≡] [INARI wordmark] [Tenant switcher ▾]  [search?] [Theme] [Avatar] │
├───────────┬────────────────────────────────────────────────┤
│ Sidebar   │  Content: max-width 1280px, px-6, py-6         │
│ 240px,    │  Page header zone (see below)                  │
│ bg-base,  │  Content zones                                 │
│ border-r  │                                                │
│ 2px       │                                                │
└───────────┴────────────────────────────────────────────────┘
```

- Sidebar: 240px fixed, `bg-base`, 2px right border (`--border-subtle`), logo block 56px high (aligns with top bar). Nav groups keep the current Deliver / Operate / Govern labels, rendered as `.nav` with `.nav-item` (mono-label, 11px uppercase), active item = `aria-current="page"` + `.accent-secondary-border-left` 3px orange bar (Inari accent override of the magenta default) + invert text.
- **Nav badge counts**: pending approvals and degraded clusters render a `.badge.badge-warning` / `.badge-danger` count right-aligned in the nav item.
- Sidebar is collapsible to 64px icon rail at 1024–1279px.
- Top bar: hamburger (mobile only), tenant switcher as `.combobox`-style trigger (mono label showing `ORG / TEAM`); right side: `ThemeToggle` (DS component), `.avatar` with user menu (`.menu`).
- **Logo block (sidebar, 56px)**: the **Inari project icon** (`build/icons/icon-inari.svg`, 24px, constant identity mark — keeps its magenta/orange tones per DS rule 5, not re-themed to the orange brand chain) sits **left of the `INARI` wordmark** (Geist 700, `--text-body` 16px, brand-orange `b`).
- Content: centered, max 1280px, 24px gutters, 24px vertical rhythm (`--space-6`). 12-col grid, gutter 24px.

**Breakpoints**
- **1440px (wide/desktop)**: full sidebar 240px, content max 1280 centered; catalog grid 4-up; overview 12-col with asymmetric spans.
- **390px (mobile)**: sidebar → `.drawer` (DS Drawer, 300px, left side); top bar compresses (wordmark hidden, switcher becomes icon+label truncated); bottom **no** tab bar (DS allows bottom tab nav for mobile apps; a console with deep IA keeps the drawer nav); content single column, 16px gutters; tables become stacked `.list` rows; filter bars collapse behind a "Filters" `.btn-ghost` with active-filter count chip.

**Page header pattern (all pages, uniform)**

```
[mono-label breadcrumb:  DELIVER / CATALOG]          ← text-tertiary, Geist Mono 11px
[H1 — Geist 700 32px (--text-h3 at 390px)]  [primary action .btn-accent]
[optional one-line lede, text-body-sm text-secondary] — only when non-obvious
```

The old automatic "Tenant `<mono>`:" prefix in descriptions is removed; tenant context lives in the switcher.

**Status color mapping (uniform everywhere, incl. ext-argocd)**

| Meaning | Console status | ArgoCD health | Tokens |
|---|---|---|---|
| Healthy/Connected/Approved/Online | healthy | Healthy | `--status-success-fg` on `--status-success-bg` |
| Pending/Progressing/Attention | pending | Progressing | `--status-warning-fg` on `--status-warning-bg` |
| Degraded/Failed/Rejected/Missing/Degraded | degraded | Degraded, Missing | `--status-danger-fg` on `--status-danger-bg` |
| Suspended/Cordoned/Unknown/Revoked | cordoned | Suspended, Unknown | `--status-neutral-fg` on `--status-neutral-bg` |
| Curated/Platform/Discovered/Template (non-status!) | — | — | neutral `.badge` / `.tag`, never status hues |

Source badges (curated/discovered/platform/template) are **not machine state** and therefore use neutral `.tag` variants, not warning/success colors (fixes current misuse of `warning` for "Platform").

---

## 3. Per-section redesign specs

### 3.1 Shell (top bar + sidebar)

DS components: `Nav`/`NavItem` (or `.nav` classes), `Avatar`, `ThemeToggle`, `Drawer`, `Tooltip`, `.menu` for user dropdown, `.combobox` for tenant switcher.

- Tenant switcher: `.btn-ghost`-style trigger, mono label `ACME-INC / PLATFORM`, `Building2` icon, chevron. Dropdown: `.menu` with section mono labels `ALL TENANTS / RECENT / ORGANIZATIONS / TEAM SCOPE`, check-mark on active, 2px dividers. Active tenant also mirrored in sidebar footer strip? No — keep single source in top bar.
- User menu: `.avatar` (32px square, 2px border, mono initials) → `.menu` with `Sign out` `.menu-item`.
- Sidebar groups: mono group labels (`--text-mono-label`, `--text-tertiary`, `px-2 pb-1`), items 32px tall, **icons: the existing lucide set kept at 16px** (`lucide-react`, `currentColor` — LayoutDashboard, BookOpen, Ship, Layers, CheckCircle2, Server, Grid2X2, Cloud, Boxes, Workflow, KeyRound, FileClock, Puzzle, Settings; Resources uses CircleDot), no emoji or glyph stand-ins. Active: orange 3px left bar + `--bg-overlay` fill. Group spacing `--space-4`.
- Sidebar footer (new): extension nav items render under a mono label `EXTENSIONS` group, separated by 2px rule.

States: collapsed rail shows icons with `Tooltip`; mobile drawer locks scroll, closes on navigate.

### 3.2 Overview (home)

DS: `.grid`, `.card` (+ `.accent-secondary-border-top` for the alert-worthy card), `.stat`, `.badge`, `.list`, `.empty`, `.skeleton`.

- Header: breadcrumb `OVERVIEW`, H1 = tenant display name (mono), right side `.btn-accent` "Register cluster" + `.btn-secondary` "Browse catalog".
- **Stat row (new)**: 4 `.stat` across 12 cols: Clusters (n healthy / n total), Pending approvals (count, `.stat-accent` orange when >0), Drift (n resources), Resources (n / n healthy). Values Geist Mono 24px tabular-nums, labels mono 11px uppercase.
- Cards grid: 12-col, `lg:grid-cols-12`; ClusterHealth spans 7, Activity spans 5 and is full-height; PendingApprovals 5; ResourceHealth 7; Drift 5; QuickActions 5. Cards: 2px border, `bg-elevated`, header = mono label + count badge; body lists use `.list`.
- PendingApprovalsCard gets `.accent-secondary-border-top` + orange value when count > 0 — glanceable priority.
- Empty/loading: cards individually skeleton (`.skeleton` rows); empty card bodies use `.empty` dashed placeholder with one `.btn-ghost` CTA.

### 3.3 Catalog browse

- Header: `DELIVER / CATALOG`, H1 "Catalog", lede omitted; right: `.btn-accent` "Deploy from template" (→ templates).
- **Filter bar as toolbar (redesigned)**: single row, sticky under top bar (`z-sticky`), `bg-base` 2px bottom border: `.input` search (with `.input-addon` Search icon, debounced 300ms — kept), source `.tag` filter group (All/Curated/Discovered/Platform/Template as `.tag` toggles, active = `.tag` outlined), category + cluster `.select-native`, sort `.select-native`, view toggle `.btn-group` with two `.btn-icon` (grid/list). Active filter count chip (`.chip`) + "Clear" `.btn-ghost` appears when `hasActive`.
- Results: grid mode `.grid-4` cards (card: name Geist 600 16px, provider mono caption, source `.tag`, version `.code-inline`, updated mono relative time; hover invert border + `.glow-mod-secondary` on "Deploy" `.btn-accent` inside card footer); list mode `.table` (mono uppercase headers: NAME / SOURCE / CATEGORY / VERSION / UPDATED / ACTIONS).
- Pagination: `.pagination` `.page-btn` (32px squares), kept URL-driven.
- Extension slot `CatalogCardSlots` renders in a card footer strip (`ext-argocd` GitOps badge — see 3.9).
- States: loading = 8 `.skeleton` cards; empty search result = `.empty` with "No items match" + Clear filters `.btn-secondary`; empty catalog = `.empty` + "Register a cluster to discover capabilities" CTA.

### 3.4 Catalog item detail

- Two-column: left 8 cols — header (icon-box 40px, name, source tags, description), capability matrix `.table` (per-cluster availability with `.status-dot`), README-ish body; right 4 cols sticky — "Deploy" `.card` with version `.select-native`, target cluster `.select-native`, `.btn-accent.btn-glow` "Deploy" full width, policy hints as `.alert-info`.
- Tabs (Overview / Versions / Instances) use DS `.tabs` with `.tab-accent` (orange underline).

### 3.5 Deploy wizard (and scaffold/connect wizards)

- Full-width stepper `.stepper` (numbered squares with connecting 2px line — replaces circles+arrows): CONFIGURE → REVIEW → STATUS. Current step numbered white-on-black; done steps get `.badge-success` check; `aria-current="step"`.
- Steps content in `.card` max-width 720px centered; form fields DS `.input`/`.select-native`/`.form-label`; RJSF schema form renders with DS form classes (new wrapper — see components.md).
- Review step: definition list rendered mono (`--text-mono-body`), diff-able values in `.code-block`.
- Status step: live deploy phase as `.progress` (`.progress-accent`) + phase `.badge`; success = `.alert-success`, failure = `.alert-danger` with retry `.btn-secondary`.

### 3.6 Approvals

- Header: `DELIVER / APPROVALS`, H1 "Approvals". Right: view switch as DS `.tabs` (INBOX / REQUESTED BY ME) with `.tab-accent`; pending count in a `.badge-warning` on the Inbox tab.
- List = `.list` of approval rows: requester `.avatar-sm` + name, action mono (`DEPLOY postgres@v1.2.3 → cluster-acme-1`), relative time mono, status `.badge`. Pending rows show Approve `.btn-accent.btn-sm` / Reject `.btn-danger.btn-sm`; other states are read-only rows.
- Decision modal: DS `Modal` (`.modal`, 2px border, 8px hard offset shadow), mandatory reason `.textarea` with `.field-error`, confirm buttons `.btn-accent` / `.btn-danger`; focus trapped, reason labelled.
- States: loading skeleton rows; empty inbox = `.empty` "No pending approvals" with `.badge-success` "Queue clear" flavor; error = `.alert-danger` with Retry `.btn-secondary`.

### 3.7 Clusters (list)

- Header: `OPERATE / CLUSTERS`, H1 "Clusters", right `.btn-accent` "Register cluster".
- Replace 9-button filter row with: status `.select-native` filter (All + statuses) **plus** quick filter `.tag` chips for the three states that matter (Degraded, Pending, Disconnected) with live counts; selection synced to URL (`?status=`) — generalizes the catalog URL-state pattern.
- Table (desktop): `.table` mono headers NAME / STATUS / VERSION / NODES / AGE / ACTIONS; status cells = `.status-dot` + mono status text (dot color = status, not background pills — thinner). Row hover `--bg-overlay`; actions in a `.menu` (`⋯` trigger) except the primary action inline (Connect / Cancel).
- Mobile: cards `.list` with same data stacked.
- Destructive confirm: DS `Modal` with `.btn-danger` confirm (replaces `window.confirm`).
- States: 6 skeleton rows; empty = `.empty` "No clusters registered" + `.btn-accent` "Register your first cluster"; degraded > 0 → `.banner` warning strip under page header (`.banner` full-width, warning border) listing count + link.

### 3.8 Cluster detail & fleet

- Detail: header = cluster name H1 + status `.badge` + actions (`.btn-secondary` "Connect", `.btn-ghost` "Kubectl access" opens DS `Drawer` with the `kubectl-access-card` in a `.code-block` + copy `.btn-icon`). Below: DS `.tabs` (OVERVIEW / CONNECT / INSTANCES / ARGOCD† / AUDIT) with `.tab-accent`. †ArgoCD tab is the ext-argocd ClusterTab slot.
- Overview tab: stat row (nodes, CPU, mem, age) + conditions `.list` + drift card.
- Fleet overview: stat row (clusters, cluster sets, rolling updates, drifted) + cluster-set cards `.grid-3`, each with mini health `.progress` bars; rollout detail uses `.timeline` for rollout steps + `.progress-accent` per cluster progress.
- Registers wizards follow 3.5 stepper spec.

### 3.9 ext-argocd extension surfaces

All three slots are re-skinned to DS classes and read tokens from the host (no hardcoded hexes):

- **HealthBadge** → DS `.badge` variants: Healthy `.badge-success`, Progressing `.badge-warning`, Degraded/Missing `.badge-danger`, Suspended/Unknown `.badge-neutral` (mono uppercase 11px, 1px border, `--status-*-bg` fills per DS rule 4). The inline `style` object and `HEALTH_COLORS` map are deleted.
- **ClusterTab (ArgoCD health)**: container `.card` with mono header `ARGOCD HEALTH — <cluster>`; instance rows `.list-item`: instance name (mono), kind `.tag`, sync `.badge`, health `.badge`; loading `.skeleton` rows; error `.alert-danger`; empty `.empty` "No Inari-managed instances".
- **CatalogCard (GitOps badge)**: footer strip in catalog card — `.tag` "GITOPS / ARGOCD" + health badge inline; uses `--brand-secondary` accent.
- **InstanceActions**: the sync/refresh entries are `InstanceActionBlueprint` registrations in the extension's `ui/src/index.tsx` (host renders the action buttons); they re-skin as `.btn-ghost.btn-sm` with `.spinner` on pending, confirm sync via host-provided `Modal` (host injects via plugin SDK — noted as SDK gap).

### 3.10 All-tenants home (multi-org landing)

- Header: `OVERVIEW / ALL TENANTS`, H1 "All tenants"; lede omitted.
- **Aggregate stat row (new)**: tenants (n), clusters across tenants (n healthy / n), pending approvals across tenants (`.stat-accent` when >0), degraded resources — the answer to "what needs me?" before any drill-in.
- Tenant strips: `.list` of tenant rows — tenant name (mono), org `.tag`, per-tenant mini stats inline (clusters · approvals · drift as mono `n/n` pairs), chevron → deep link carries tenant context. Row hover `--bg-overlay`.
- Below: per-tenant card grid collapses into these rows (replaces the current stacked equal-weight cards).

### 3.11 Resources

- Header: `OPERATE / RESOURCES`, H1 "Resources"; filter toolbar same pattern as catalog: `.input` search (name/kind), cluster `.select-native`, status `.tag` quick chips (Drifting, Degraded, Progressing) with counts, URL-synced.
- Table (desktop): mono headers NAME / KIND / CLUSTER / VERSION / DRIFT / STATUS / ACTIONS; status = `.status-dot` + mono text; drift column shows mono `±n` with danger accent when >0; upgrade available → inline `.btn-accent.btn-sm` "Upgrade", else row `⋯` `.menu`.
- Detail: header name + kind `.tag` + cluster link; stat row (replicas, age, version, drift); conditions `.list`; **upgrade flow inline in page** (not modal): version `.select-native` + `.stepper`-less confirm strip `.btn-accent` "Upgrade" + `.alert-info` policy hint; progress via `.progress-accent`.
- Mobile: stacked `.list` rows.

### 3.12 Zones

- Header: `OPERATE / ZONES`, H1 "Zones"; `.btn-accent` "Vend zone".
- Table: NAME / REGION / CLUSTER COUNT / STATE / AGE / ACTIONS; state `.badge` (Ready `.badge-success`, Provisioning `.badge-warning`, Failed `.badge-danger`).
- Detail: stat row + provisioned clusters `.list` + capacity `.progress` bars.
- Vend wizard follows 3.5 stepper spec (REGION → CONFIGURE → REVIEW → STATUS).

### 3.13 Cloud accounts

- Header: `OPERATE / CLOUD ACCOUNTS`, H1 "Cloud accounts"; `.btn-accent` "Connect account".
- List: `.grid-3` cards (provider icon `.icon-box`, name, account-id mono caption, state `.badge`, last-sync mono relative time); states Connected `.badge-success`, Pending `.badge-warning`, Error `.badge-danger` — **delete the local `status-badge.tsx` hues, use the shared status map**.
- Connect wizard: 3.5 stepper (PROVIDER → CREDENTIALS → VERIFY); credential fields in `.code-block`-framed `.input`s; verify step = `.progress-indeterminate` + result `.alert-success`/`.alert-danger`.
- Detail: stat row + discovered projects `.list` + disconnect `.btn-danger` with DS `Modal` confirm.

### 3.14 Organizations (create)

- Full-page centered `.card` max-width 640px (not a wizard chrome — a single form): H1 "Create organization", `.form-group` fields (name, slug mono live-preview, idp `.select-native`), `.btn-accent` "Create"; error = `.field-error` per field.

### 3.15 Settings / Access / Audit / Extensions / Platform

- Settings keeps its sub-pages but replaces `settings-layout` custom nav with DS `.nav` vertical inside a 3-col layout (nav 240 / content 9 cols), active `.nav-item-accent` (orange). Sub-pages (org profile, idp, git + git-connections, domains, policies: approvals-config/compliance/exemptions/packs/visibility, tokens: eso-stores/registration-tokens, notifications, identity clients/scopes) all render inside this frame: section headers use the uniform page-header pattern (mono breadcrumb `SETTINGS / <SECTION>`), forms use DS `.form-group`/`.input`/`.select-native`, destructive settings (delete domain, rotate secret) use DS `Modal` confirm with `.btn-danger`, feature-flag-style toggles use `.toggle-accent`. The `capability-gate` wrapper renders as `.alert-warning` with mono policy code.
- Access: role matrix becomes a proper `.table` with `.checkbox` cells (mono row/col headers); members list `.list` with role `.select-native` inline; feature flags become DS `.toggle` list.
- Audit log: filter bar (actor/action/date `.input`/`.select-native`) + `.table` with mono timestamps (tabular-nums), expandable rows via `.tree-item`? — keep simple: row click opens DS `Drawer` with entry JSON in `.code-block`.
- Extensions page: two `.card` sections (UI / Backend) with slot chips `.tag`, state `.badge`, and per-extension `.menu` actions; "Install extension" `.btn-accent` in header.
- Platform: stat row + module cards `.grid-3` with health `.status-dot`.

---

## 4. Cross-cutting specs

### 4.1 States (applies to every data surface)

| State | Spec |
|---|---|
| Loading | `.skeleton` placeholders shaped like the content (rows/cards), 1.2s opacity pulse; never plain "Loading…" text. Polling refresh (clusters 15s, deploy 1.5s) shows a 2px `.progress-indeterminate` bar at content top, no full reload. |
| Empty | `.empty`: 2px dashed `--border-strong` at 25% opacity, centered: mono label title, one-line body, one primary CTA `.btn-secondary`. Never grey boxes. |
| Error | `.alert-danger` with message + Retry `.btn-secondary` (refetch); fatal/route errors keep error boundary but rendered as `.alert-danger` in `.card`. |
| Permission denied | `PolicyDenialNotice` → `.alert-warning` + mono policy code. |

### 4.2 Motion

- App shell: **no ambient animation** (DS rule: dashboards must not use ambient animations).
- Triggers allowed: `.slide-up-reveal` on modal/drawer/toast mount; `.glitch` (0.3s burst) on filter-set change of the main table content only; button invert transitions `--duration-fast 150ms` with `--ease-out`.
- Reduced motion: everything collapses via DS `accessibility.css` (`prefers-reduced-motion`) — no custom work.

### 4.3 Accessibility

- All nav items real links with `aria-current`; tabs follow DS Tabs ARIA; modals/drawers trap focus, `aria-modal`, Esc to close, body scroll lock.
- Status is never color-only: badges include text, status dots paired with mono text.
- Focus rings: DS `--border-focus` (orange under `data-project=inari`), visible on all interactive elements.
- Type contrast: body text `--text-primary` on `--bg-elevated` ≥ 7:1; mono labels `--text-tertiary` ≥ 4.5:1.

### 4.4 Token cheat-sheet used in specs (dark theme, Inari scope)

```
--bg-void #000000   --bg-base #0A0A0D   --bg-elevated #131318  --bg-raised #1C1C22
--text-primary #FAFAFB  --text-secondary #B0B0B8  --text-tertiary #6B6B72
--border-subtle rgba(255,255,255,.06)  --border-default rgba(255,255,255,.10)  --border-strong rgba(255,255,255,.18)
--brand-primary #EE560D (inari-500)  -hover #E56F3F? → inari-400 #E56F3F  -active #C44813 (inari-600)
--brand-primary-glow color-mix(#EE560D 25%, transparent)
--border-focus #EE560D
status: --status-success #00E676, --status-warning #FFB300, --status-danger #FF3B5C, --status-neutral #82828A (+ -bg/-fg pairs)
type: page title --text-h3 2rem/600 (display sizes reserved for marketing); body --text-body 1rem; labels --text-mono-label 11px mono 500 .12em uppercase; data --text-mono-body 13px tabular-nums
spacing: 4px grid; page gutters 24px (16px mobile); card padding 16–24px; section rhythm 24px
radius: 0 on 1-bit components (buttons 4px per modern button system); borders 2px
shadow: --shadow-glow for accent emphasis; hard 8px offset only on .modal/.toast
motion: --duration-fast 150ms / --duration-base 240ms, --ease-out
```

Exact values above are the resolved dark-theme values from `7k-design-system/src/css/tokens.css` + `projects.css`; consumers must reference role tokens, never raw hexes.

---

## 5. What is explicitly removed

- shadcn/ui component set and `tailwind.config.ts` theme tokens (replaced by DS; Tailwind may remain as utility engine but with DS token values if kept).
- `window.confirm` usage.
- Inline-style health pills in ext-argocd.
- Auto-generated tenant prefix sentences in page descriptions.
- Rounded-full stepper, arrow-separated wizard indicator.
