# M1W2 — Repo Registry Settings — Design Index

- **Task**: `[M1W2] UI repo registry settings` (Kandev: fbbb3fdd-0db4-4f4b-acb5-6b8c25113278)
- **Parent plan**: Multi-repo GitOps, Feature A (Kandev: 8f8c472a-4633-4965-99d0-8ef7a3ae62b3)
- **Penpot file**: [Inari Console](https://penpot.7kgroup.org/workspace/58349be9-a075-8103-8008-ccc4498f00ba) — project `inari-ui`, file `Inari Console`, page `Screens`
- **Shared library**: `7K Design System` (connected, id `12a76929-1c9e-81ad-8008-ca822821d110`)
- **Project accent**: Inari — burnt orange `--inari-500: #EE560D` via `data-project="inari"` / `ProjectProvider defaultProject="inari"`
- **Surface**: Product dashboard (DESIGN.md §5–7 rules)
- **DS breakpoints**: 1440px (all boards are 1440×900)

> **Component usage**: Boards use `Shell`, `Topbar`, `Sidebar`, `Settings Sidebar` from the local Inari Console library; `Input`, `Select`, `Radio`, `Toggle`, `button/primary`, `badge/default` (with Tone variants: accent, neutral, warning, success), `alert/default`, `modal/default` from the 7K DS shared library; DS icon components (`GitBranch`, `GitFork`, `FolderGit2`, `Copy`, `KeyRound`, etc.). Elements that have no DS component equivalent (repo option cards, table structure, org defaults card, GitOps repo card) are raw shapes styled to match DS token specs.

---

## Board Manifest

All boards live on the `Screens` page of the Inari Console file, inside or near the `Settings` group.

| # | Board Name | Board ID | Description |
|---|-----------|----------|-------------|
| 1 | `screens / settings-org-git-repos` | `2725061e-0111-80a2-8008-d1c5717261ba` | Main repo list page (replaces old single-repo form) |
| 2 | `screens / settings-org-git-repos / drawer` | `6c74db3b-6311-80fd-8008-d57856e6733d` | Per-repo settings drawer (right overlay) |
| 3 | `screens / settings-org-git-repos / register` | `6c74db3b-6311-80fd-8008-d5795af8957d` | Register existing repo modal |
| 4 | `screens / repo-delete-blocked` | `6c74db3b-6311-80fd-8008-d578b8ad3203` | Delete blocked (has live workloads) |
| 5 | `screens / repo-delete-orphan` | `6c74db3b-6311-80fd-8008-d578b94b2886` | Delete with force=orphan |
| 6 | `screens / repo-delete-teardown` | `6c74db3b-6311-80fd-8008-d578b9e487bd` | Delete with force=teardown |
| 7 | `screens / deploy-wizard / repo-picker` | `6c74db3b-6311-80fd-8008-d579cb6b6b72` | Deploy wizard Configure step with repo picker |
| 8 | `screens / resource-detail / repo-links` | `6c74db3b-6311-80fd-8008-d57a8f85fe5a` | Instance detail with GitOps repo card |
| 9 | `screens / gitops-repo-new` | `6c74db3b-6311-80fd-8008-d57b5698a2a5` | Placeholder: New GitOps repo template picker |
| 10 | `screens / settings-org-git-repos / empty` | `6c74db3b-6311-80fd-8008-d57b27ee5486` | Empty state (no repos) |
| 11 | `screens / settings-org-git-repos / loading` | `6c74db3b-6311-80fd-8008-d57b2af4f549` | Loading state (skeleton rows) |
| 12 | `screens / settings-org-git-repos / error` | `6c74db3b-6311-80fd-8008-d57b2d5bbfa6` | Error state (load failure) |

---

## Screen 1: Org Settings → Git (Repo List)

**Board**: `screens / settings-org-git-repos` (reworked from the original single-repo `settings-org-git`)

### Layout

| Zone | Position (parentXY) | Size | Content |
|------|-------------------|------|---------|
| Breadcrumb | (590, 90) | — | `GOVERN / SETTINGS / ORG / GIT` — mono-label 11px, `--text-tertiary` |
| Page title | (591, 112) | — | `Git` — Geist 28px bold, `--text-primary` |
| Description | (591, 142) | — | `GitOps state repositories and commit policies for this organization.` — Geist 13px, `--text-secondary` |
| Primary CTA | (1250, 108) | 160×40 | `NEW GITOPS REPO` — DS `button/primary` (magenta outline) |
| Section label | (590, 190) | — | `GIT REPOSITORIES` — mono-label 11px, `--text-tertiary` |
| Ghost CTA | (1230, 184) | 180×32 | `+ REGISTER EXISTING` — ghost button, 1px `--text-tertiary` border |
| Table card | (590, 220) | 820×320 | `--bg-elevated` background |
| Org defaults label | (590, 570) | — | `ORG DEFAULTS` — mono-label 11px |
| Org defaults card | (590, 594) | 820×180 | `--bg-elevated` background |

### Repo Table Columns

| Column | x (in card) | Width | Content Style |
|--------|-----------|-------|---------------|
| NAME | 16 | ~140 | Geist 14px semibold, `--inari-500` (link color) |
| REPOSITORY | 166 | ~180 | Geist Mono 12px, `--text-secondary` |
| SCOPE | 356 | ~80 | Badge: PLATFORM = `--inari-subtle` bg + `--inari-500` fg; TEAM = `--neutral-bg` + `--neutral-fg` |
| TEAM | 446 | ~100 | Geist 13px, `--text-secondary`; `—` for platform repos |
| POLICY | 556 | ~100 | Badge: DIRECT = `--neutral-bg` + `--neutral-fg`; PR = `--warning-bg` + `--warning-fg` |
| DEFAULT | 666 | ~70 | Badge: `--success-bg` + `--success-fg`, text `DEFAULT` |
| PROVIDER | 746 | ~80 | Geist 13px, `--text-secondary` |

### Sample Data (4 rows)

| Name | Repository | Scope | Team | Policy | Default | Provider |
|------|-----------|-------|------|--------|---------|----------|
| baseline | 7K-Group/acme-inari-state | PLATFORM | — | DIRECT | ✓ | GitHub |
| team-alpha-gitops | 7K-Group/team-alpha-gitops | TEAM | Team Alpha | PR | — | GitHub |
| team-beta-gitops | 7K-Group/team-beta-gitops | TEAM | Team Beta | DIRECT | — | GitHub |
| team-gamma-gitops | acme-corp/team-gamma-gitops | TEAM | Team Gamma | PR | — | GitHub |

### Org Defaults Card

| Field | Label | Value |
|-------|-------|-------|
| Commit policy default | `COMMIT POLICY DEFAULT` | `direct` — Geist Mono 13px |
| Scaffold git org | `SCAFFOLD GIT ORG` | `7K-Group` — Geist Mono 13px |
| Edit button | — | `EDIT DEFAULTS` — ghost button, 1px border |

---

## Screen 2: Repo Settings Drawer

**Board**: `screens / settings-org-git-repos / drawer`

### Layout

| Zone | Position (parentXY) | Size | Content |
|------|-------------------|------|---------|
| Backdrop | (0, 0) | 1440×900 | `#000000` at 60% opacity |
| Drawer panel | (1020, 0) | 420×900 | `--bg-raised`, 1px `--border-subtle` left border |
| Drawer header label | (24, 24) | — | `REPOSITORY SETTINGS` — mono-label 11px |
| Repo name | (24, 44) | — | `team-alpha-gitops` — Geist 20px semibold |
| Full repo path | (24, 72) | — | `7K-Group/team-alpha-gitops` — Geist Mono 12px |
| Separator | (24, 100) | 372×1 | `--border-subtle` |

### Drawer Form Fields

| Field | Label | Value | Notes |
|-------|-------|-------|-------|
| Display name | `DISPLAY NAME` | `team-alpha-gitops` | Editable |
| Repository | `REPOSITORY` | `7K-Group/team-alpha-gitops` | Read-only (dimmed) |
| Commit policy | `COMMIT POLICY` | `pull_request` | Select dropdown |
| Base branch | `BASE BRANCH` | `main` | Editable |
| Owning team | `OWNING TEAM` | `Team Alpha` | Select dropdown |

### Drawer Actions

| Action | Position | Style |
|--------|----------|-------|
| Set as default toggle | (360, 460) | 36×20 toggle, off state |
| Toggle description | (24, 478) | `New clusters and deploys fall back to this repo.` |
| Save Changes | (24, 530) | 372×40, `--inari-subtle` bg + `--inari-500` border + text |
| Danger Zone separator | (24, 610) | 372×1 |
| Danger Zone label | (24, 630) | `DANGER ZONE` — mono-label, `--danger-fg` |
| Delete description | (24, 650) | `Unregister this repo from Inari…` |
| Delete Repo button | (24, 680) | 160×36, `--danger-bg` + `--danger` border |

---

## Screen 3: Register Existing Repo Modal

**Board**: `screens / settings-org-git-repos / register`

### Layout

| Zone | Position (parentXY) | Size | Content |
|------|-------------------|------|---------|
| Backdrop | (0, 0) | 1440×900 | `#000000` at 60% opacity |
| Modal | (440, 190) | 560×564 | `--bg-raised`, 2px `--border-default` |
| Modal title | (32, 28) | — | `Register Existing Repository` — Geist 20px semibold |
| Modal desc | (32, 56) | — | `Connect an existing Git repository…` — Geist 13px |
| Separator | (32, 84) | 496×1 | `--border-subtle` |

### Form Fields

| Field | Label | Placeholder/Value |
|-------|-------|-------------------|
| Display name | `DISPLAY NAME` | `my-team-gitops` |
| Repository | `REPOSITORY (OWNER/NAME)` | `myorg/my-repo` |
| Base branch | `BASE BRANCH` | `main` |
| Scope | `SCOPE` | Radio: Platform / **Team** (selected) |
| Owning team | — | `Team Alpha` (select, shown when Team scope) |
| Commit policy | `COMMIT POLICY` | `pull_request` |

### Buttons

| Button | Position | Style |
|--------|----------|-------|
| Cancel | (32, 500) | 240×40, ghost |
| Register Repo | (288, 500) | 240×40, `--inari-subtle` bg + `--inari-500` border |

---

## Screens 4–6: Delete Confirmation Variants

### Blocked (`screens / repo-delete-blocked`)

| Element | Content |
|---------|---------|
| Title | `Cannot Delete Repository` |
| Alert | Warning bg (`--warning-bg`), text: `This repo has 3 running instances and 2 managed addons. Unregistering it would orphan these workloads.` |
| List label | `AFFECTED WORKLOADS` — mono-label |
| Workload list | `postgres-prod (instance)`, `redis-cache (instance)`, `cert-manager (addon)`, `external-secrets (addon)`, `istio-ingress (addon)` |
| Action | `UNDERSTOOD` — single button, no delete option |

### Orphan (`screens / repo-delete-orphan`)

| Element | Content |
|---------|---------|
| Title | `Delete Repository (Orphan)` |
| Alert | Info bg (`--info-bg`), text: `Orphan mode unregisters the repo from Inari. Running workloads keep operating but are no longer managed.` |
| Delete mode | Radio: **Orphan** (selected, orange) / Teardown (unselected) |
| Actions | `CANCEL` (ghost) + `DELETE REPO` (danger) |

### Teardown (`screens / repo-delete-teardown`)

| Element | Content |
|---------|---------|
| Title | `Delete Repository (Teardown)` |
| Alert | Danger bg (`--danger-bg`), text: `Teardown deletes all workloads and ArgoCD apps managed by this repo. This action cannot be undone.` |
| Delete mode | Radio: Orphan (unselected) / **Teardown** (selected, red) |
| Confirm input | Label: `TYPE "team-alpha-gitops" TO CONFIRM`, input with danger border |
| Actions | `CANCEL` (ghost) + `TEARDOWN` (danger) |

---

## Screen 7: Deploy Wizard — Repo Picker

**Board**: `screens / deploy-wizard / repo-picker`

### Layout

Standard deploy wizard shell with stepper (Step 1 CONFIGURE highlighted). Card at (480, 220), 720×520.

### Repo Picker Section

| Element | Position (in card) | Content |
|---------|-------------------|---------|
| Section label | (24, 200) | `GITOPS REPOSITORY` — mono-label 11px |
| Hint text | (24, 218) | `Only repos visible to your team are shown. Default is preselected.` — Geist 12px |
| Option 1 (selected) | (24, 244) | **baseline** — PLATFORM badge, DIRECT COMMIT badge, DEFAULT badge |
| Option 2 | (24, 316) | **team-alpha-gitops** — TEAM badge, PULL REQUEST badge, `owned by Team Alpha` |
| Option 3 | (24, 388) | **team-beta-gitops** — TEAM badge, DIRECT COMMIT badge, `owned by Team Beta` |

### Repo Option Card Style

| State | Border | Background |
|-------|--------|------------|
| Selected | 2px `--inari-500` | `--inari-subtle` at 50% |
| Unselected | 1px `--border-subtle` | `--bg-raised` |

Each option: radio indicator (14×14), repo name (Geist 14px semibold), repo path (Geist Mono 11px), scope badge, policy badge, team label, optional DEFAULT badge.

---

## Screen 8: Instance Detail — Repo Links

**Board**: `screens / resource-detail / repo-links`

### New Card: GitOps Repository

| Element | Position (parentXY) | Size | Content |
|---------|-------------------|------|---------|
| Card | (266, 540) | 657×160 | `--bg-elevated` |
| Card title | (24, 20) | — | `GitOps Repository` — Geist 16px |
| Separator | (24, 48) | 609×1 | `--border-subtle` |
| Repo name | (24, 62) | — | `team-alpha-gitops` — Geist 14px semibold, `--inari-500` |
| Repo path | (24, 84) | — | `7K-Group/team-alpha-gitops` — Geist Mono 12px |
| Policy badge | (400, 60) | 100×22 | `PULL REQUEST` — `--warning-bg` + `--warning-fg` |
| Commit label | (24, 112) | — | `COMMIT` — mono-label |
| Commit value | (24, 130) | — | `a1b2c3d` — Geist Mono 13px, `--info-fg` (link) |
| PR label | (200, 112) | — | `PULL REQUEST` — mono-label |
| PR value | (200, 130) | — | `#142 · merged` — Geist Mono 13px, `--info-fg` (link) |

---

## Screen 9: Placeholder — New GitOps Repo

**Board**: `screens / gitops-repo-new`

Template picker placeholder. Two built-in templates shown as cards. Each card: template name (Geist 16px semibold, `--inari-500`), description (Geist 13px), `BUILT-IN` tag badge, `USE TEMPLATE` button. Footer note: `More templates coming in M2.`

---

## Screens 10–12: Empty / Loading / Error States

All three reuse the main repo list page shell with content area variations at (590, 220).

### Empty (`/empty`)
- Dashed border card (2px dashed, 15% opacity), centered
- Title: `No repositories registered`
- Description: `Register an existing GitOps repo or create a new one from a template.`
- Two buttons: `REGISTER EXISTING` (ghost) + `NEW GITOPS REPO` (accent)

### Loading (`/loading`)
- 4 skeleton rows (820×48 each, `--bg-elevated` at 50%)
- Label: `LOADING REPOSITORIES…`

### Error (`/error`)
- Danger card: `--danger-bg` at 30%, 1px `--danger` border
- Title: `Failed to load repositories` ( `--danger-fg`)
- Description + `RETRY` button

---

## Design-to-Code Token Mapping

### Colors (CSS custom properties)

| Design Token | CSS Variable | Hex (dark) |
|-------------|-------------|-----------|
| `--bg-base` | `var(--bg-base)` | `#0A0A0D` |
| `--bg-elevated` | `var(--bg-elevated)` | `#131318` |
| `--bg-raised` | `var(--bg-raised)` | `#1C1C22` |
| `--bg-overlay` | `var(--bg-overlay)` | `#26262B` |
| `--text-primary` | `var(--text-primary)` | `#FAFAFB` |
| `--text-secondary` | `var(--text-secondary)` | `#B0B0B8` |
| `--text-tertiary` | `var(--text-tertiary)` | `#82828A` |
| `--text-placeholder` | `var(--text-placeholder)` | `#6B6B72` |
| `--border-subtle` | `var(--border-subtle)` | `rgba(255,255,255,0.06)` |
| `--border-default` | `var(--border-default)` | `rgba(255,255,255,0.10)` |
| `--inari-500` (accent) | `var(--brand-primary)` (in project scope) | `#EE560D` |
| `--inari-subtle` | `var(--brand-primary-subtle)` | `#2B1C17` |
| `--status-success-bg` | `var(--status-success-bg)` | `#002915` |
| `--status-success-fg` | `var(--status-success-fg)` | `#5CE69A` |
| `--status-warning-bg` | `var(--status-warning-bg)` | `#332400` |
| `--status-warning-fg` | `var(--status-warning-fg)` | `#FFCE5C` |
| `--status-danger-bg` | `var(--status-danger-bg)` | `#330A10` |
| `--status-danger-fg` | `var(--status-danger-fg)` | `#FF5C7A` |
| `--status-info-bg` | `var(--status-info-bg)` | `#091A33` |
| `--status-info-fg` | `var(--status-info-fg)` | `#5C99FF` |
| `--status-neutral-bg` | `var(--status-neutral-bg)` | `#1C1C22` |
| `--status-neutral-fg` | `var(--status-neutral-fg)` | `#B0B0B8` |

### Typography

| Element | Font | Size | Weight | Transform |
|---------|------|------|--------|-----------|
| Breadcrumb | Geist Mono | 11px | 500 | uppercase |
| Page title | Geist | 28px | 700 | — |
| Section label | Geist Mono | 11px | 500 | uppercase |
| Card title | Geist | 16px | 400–600 | — |
| Body text | Geist | 13–14px | 400 | — |
| Mono data | Geist Mono | 12–13px | 400 | — |
| Badge text | Geist Mono | 10–11px | 500 | uppercase |
| Button text | Geist Mono | 11px | 500 | uppercase |

### Spacing

All spacing uses the 4px grid (`--space-*` tokens). Key values: 8px, 12px, 16px, 20px, 24px, 32px.

---

## Accessibility Notes

- WCAG AA contrast: all text/background pairs meet 4.5:1 minimum
- Status never communicated by color alone: badges include text labels
- Focus indicators: `--border-focus` (`--magenta-500`) on interactive elements
- Empty state uses dashed border (not just color) to indicate placeholder
- Delete confirmations use type-to-confirm for destructive teardown action
- All form fields have associated `<label>` elements

---

## Key Design Decisions

1. **Repo list as table, not cards**: The repo registry is tabular data (7 columns). A table matches the existing settings pages (git-connections, clusters) and scales better than cards for 10+ repos.

2. **Scope badges use Inari accent for PLATFORM**: Platform repos are the infrastructure backbone — the accent color draws appropriate attention. Team repos use neutral badges to avoid visual noise.

3. **Policy badges use semantic colors**: DIRECT = neutral (no action needed), PR = warning (requires review). This maps to the semantic color system where warning = "attention needed."

4. **Drawer (not page) for per-repo settings**: Editing a repo is a focused, contextual action. A drawer keeps the repo list visible underneath and matches the existing drawer pattern in the codebase.

5. **Delete confirmations as 3 separate variants**: Blocked (informational), orphan (choice), teardown (type-to-confirm). Each escalating level of destructivity gets a proportionally stronger confirmation pattern.

6. **Repo picker in Configure step (not separate step)**: The repo picker is one field among several in the deploy configuration. Making it a separate wizard step would add unnecessary friction. The radio-card pattern makes the choice visible without leaving the form context.

7. **Instance detail repo card placed below Conditions**: The conditions card is the primary operational info. Repo metadata is secondary — placing it below avoids pushing conditions down on smaller viewports.

---

## DS Gaps / TODOs

| Gap | Proposal |
|-----|----------|
| No DS `Drawer` React component in the 7K DS React kit | Add `Drawer` to `src/react/components/Drawer.tsx` with `side`, `open`, `onClose` props |
| No DS `Toggle` switch variant for "set as default" | The `Toggle` component exists but needs a labeled variant for settings forms |
| No DS `RadioCard` component for repo picker options | Add a `RadioCard` composite: radio + title + description + badges in a bordered card |
| No DS `Skeleton` row component for table loading | Add `SkeletonRow` to the loading-state family for tabular data |
