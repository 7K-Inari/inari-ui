# Inari UI/UX Rework — Component Mapping

Foundation: `7k-design-system@1.1.1` (local checkout at `../7k-design-system`, built `dist/7k-design-system.css`).
Project scope: `<html data-project="inari">` (or `ProjectProvider defaultProject="inari"` — the DS React provider exposes `defaultProject`, not `project`) — entire brand chain = Inari burnt orange (`--inari-500 #EE560D`). Magenta appears nowhere except 7K logo marks.

## 1. Replaced: current → design system

| Current (`inari-ui`) | Replacement (import path) | Notes |
|---|---|---|
| `@/components/ui/button` (shadcn) | `Button` from `7k-design-system/react` (`.btn .btn-primary/.btn-secondary/.btn-ghost/.btn-accent/.btn-glow-accent/.btn-danger`) | `variant="accent"` = Inari orange outline; `variant="glow-accent"` = filled neon primary CTA. Size `sm` for table rows. |
| `@/components/ui/input`, `label` | `Input` from `7k-design-system/react` (`.input .form-label .field-error .input-group .input-addon`) | `onChange` signature changes (string callback) — mechanical migration. |
| `@/components/ui/badge` | `Badge` (`variant: default|accent|success|warning|danger|info|neutral`) | Status variants map 1:1 to `--status-*-bg/-fg` tokens. Source tags switch from color variants to neutral `.tag`. |
| `@/components/ui/card` | `Card, CardHeader, CardBody` (`texture?: halftone|scanline|noise|dots|crosshatch`, `hover`) | Cards get 2px border, zero radius. |
| `@/components/ui/avatar` | `Avatar` from DS | square, mono initials. |
| `@/components/ui/dialog` + `window.confirm` | `Modal, ModalHeader, ModalFooter` from DS | hard 8px offset shadow; focus trap built in. |
| `@/components/ui/sheet` (mobile nav) | `Drawer` from DS (`side="left"`) | |
| Dropdown menus (tenant switcher, user menu, row actions) | `.menu / .menu-item` classes + `Listbox` from DS | Combobox pattern for tenant switcher (`Combobox` CSS class; DS `Listbox` React component). |
| `@/components/ui/tabs` | `Tabs, TabList, Tab, TabPanel` (`.tab-accent`) | orange active underline. |
| `@/components/ui/select` | `Select` (`.select-native`) | |
| Checkbox/Radio/Toggle/Switch | `Checkbox`, `Radio`, `Toggle` from DS | `.toggle-accent` for feature flags. |
| `@/components/ui/tooltip` | `Tooltip` from DS | |
| `@/components/ui/dropdown separators etc.` | — | |
| theme-provider `ModeToggle` | `ThemeToggle` + `ThemeProvider` from DS | persists under key `7k-theme`. |
| Tailwind palette tokens (`--primary: 24 95% 30%` etc.) | DS role tokens (`--bg-*`, `--text-*`, `--border-*`, `--brand-*`, `--status-*`) | `src/index.css` loses the shadcn `:root` block; keeps only `@7k-inari/ui-plugin-sdk/tokens.css` import if still needed by SDK. |
| shadcn `Sonner`/toasts (if any) | `Toast` (`.toast .toast-success/.toast-error/.toast-warning`) | slide-up reveal on mount. |
| Loading text / nothing | `Spinner`, `Skeleton` from DS (`.spinner`, `.skeleton`, `.progress-indeterminate`) | |
| `lucide-react` icons | **kept** | DS has no icon set; lucide stays, 16px default, `currentColor`. |

## 2. Reused DS components per screen

| Screen | DS components/classes |
|---|---|
| Shell | `Nav`/`NavItem`, `Avatar`, `ThemeToggle`, `Drawer`, `Tooltip`, `.menu`, `.combobox`, `.status-dot` |
| Overview | `.grid`, `Card`, `.stat`/`.stat-accent`, `Badge`, `.list`, `.empty`, `Skeleton`, `.accent-secondary-border-top` |
| Catalog | `.toolbar`, `Input`+`.input-addon`, `.tag`, `Select`, `.btn-group`, `.btn-icon`, `Card`, `.table`, `.pagination`/`.page-btn`, `.chip`, `.empty`, `Skeleton`, `.glow-mod-secondary` |
| Item detail | `Tabs` (`.tab-accent`), `Card`, `.icon-box`, `.code-inline`/`.code-block`, `Select`, `Button variant="glow-accent"`, `.alert-info` |
| Wizards | `.stepper`, `Input`, `Select`, `Textarea`, `.form-group`, `.progress`/`.progress-accent`, `Badge`, `.alert-success/.alert-danger` |
| Approvals | `Tabs`, `.list`, `Avatar`, `Modal`, `Textarea`, `.field-error`, `Button` (accent/danger sm), `.empty`, `Alert` |
| Clusters | `.table`, `.status-dot`, `.tag` filters, `Select`, `.menu` row actions, `Modal` (confirm), `.banner`, `.empty`, `Skeleton` |
| Cluster detail | `Tabs`, `Drawer`, `.stat`, `.code-block`, `Button` |
| Fleet | `.stat`, `.grid-3`, `.progress`, `.timeline`, `Card` |
| Access | `.table`, `Checkbox`, `Toggle`, `Select`, `.list` |
| Audit | `.table`, `Input`, `Select`, `Drawer`, `.code-block` |
| Extensions | `Card`, `.tag`, `Badge`, `.menu`, `Button` |
| Settings | `Nav` vertical, `.nav-item-accent` |

## 3. New components needed (not in DS 1.1.1) → local DS build

These must be added to `7k-design-system` (implementation switches to a local build of the package):

1. **`DataTable` (React)** — opinionated wrapper: mono uppercase headers, sortable columns, row hover `--bg-overlay`, selection, sticky header, loading skeleton rows, empty state slot, mobile stacked-card transform. Props: `columns: {key,label,mono?,sortable?,width?,render?}[]`, `rows`, `rowKey`, `loading`, `empty`, `onSort`, `pagination`. Composes existing `.table` classes — pure composition, no new CSS tokens.
2. **`Stat` (React)** — `.stat` pair with props `value` (tabular-nums mono), `label`, `trend?`, `accent?: boolean` (orange value), `status?: 'success'|'warning'|'danger'|'neutral'`. CSS already exists (`.stat`, `.stat-accent`); only the React wrapper is missing.
3. **`FilterBar` (React, app-level — may live in inari-ui not DS)** — composes `Input`+addon, `.tag` toggle group, `Select`s, active-count `.chip`, Clear action; owns URL-search-param sync. App-level, styled purely with DS classes.
4. **`PageHeader` (React, app-level)** — breadcrumb mono label + H1 + actions slot; enforces the uniform header pattern.
5. **Health/status mapping utility (app-level)** — single `statusToBadge(status): BadgeVariant` + `healthToBadge(health)` shared by host and ext-argocd (exported from plugin SDK or a tiny shared package) to kill duplicated color maps.
6. **`EmptyState` (React)** — wraps `.empty` dashed box: `title`, `body`, `action` props. CSS exists; wrapper missing.
7. **`.banner` responsive sizing tweak** — DS `.banner` exists; spec adds count+link slot layout (CSS-only addition, one rule).

No new tokens, colors, fonts, or radii are introduced anywhere.

## 4. ext-argocd changes

| File | Change |
|---|---|
| `ui/src/ClusterTab.tsx` | Delete `HEALTH_COLORS` + inline styles → DS `.badge` variants via shared health→variant map; markup → `.card` + `.list` + `.empty` + `.alert-danger` + skeleton rows. |
| `ui/src/CatalogCard.tsx` | Badge → `.tag` "GITOPS · ARGOCD" + `Badge` health. |
| `ui/src/InstanceActions.tsx` | Buttons → `.btn-ghost .btn-sm` with `.spinner` state. |
| new `ui/src/health.ts` | `HEALTH_TO_BADGE: Record<string, BadgeVariant>` mapping to DS status variants. |

The extension currently bundles no DS CSS; it will import `7k-design-system/css` classes by class name only (host loads the stylesheet) — the extension must use class names, not inline styles, so host tokens apply.

## 5. Migration notes

- `main.tsx`: `import '7k-design-system/css'`, wrap `<ThemeProvider defaultTheme="dark"><ProjectProvider project="inari">`.
- Tailwind: keep for layout utilities only; delete color/shadcn theme tokens from `tailwind.config.ts` and all `bg-primary`-style usages.
- SDK tokens.css (`@7k-inari/ui-plugin-sdk/tokens.css`) — audit for collisions with DS tokens before removal.
- Delete `src/components/ui/*` (shadcn wrappers) after migration; keep `schema-form` renderer but re-skin to DS form classes.
