# inari-ui-plugin-sdk

TypeScript SDK for Inari UI extensions: extension-point blueprints, host APIs, dev harness to run an extension standalone against a dev control plane (plan §6 #7, §5.8, §8.4).

Stack: TypeScript, npm package

## Quickstart

```sh
npm create inari-ui-extension my-extension
cd my-extension && npm install && npm run dev
```

## Writing an extension

```tsx
import { createExtension, NavItemBlueprint, PageBlueprint } from '@inari/ui-plugin-sdk';

export default createExtension({
  manifest: { name: 'my-extension', version: '0.1.0', kind: 'ui' },
  slots: [
    NavItemBlueprint({ name: 'my-nav', title: 'Mine', path: '/mine' }),
    PageBlueprint({ name: 'my-page', path: '/mine', component: MyPage }),
  ],
});
```

## Docs

- [Blueprint contract](docs/blueprints.md) — typed slots, zod manifests
- [Host APIs](docs/host-apis.md) — auth/tenant contexts, API client, design tokens, testing mocks
- [Dev harness](docs/harness.md) — standalone dev against a mock control plane
- [Shared dependencies](docs/shared-dependencies.md) — React singleton contract

## Package entry points

| Import | Contents |
|---|---|
| `@inari/ui-plugin-sdk` | blueprints, `createExtension`, manifest, host APIs |
| `@inari/ui-plugin-sdk/tokens` | design tokens (TS object) |
| `@inari/ui-plugin-sdk/tokens.css` | design tokens (CSS custom properties) |
| `@inari/ui-plugin-sdk/testing` | mock host contexts for unit tests |
| `@inari/ui-plugin-sdk/harness` | `startDevHarness`, mock control plane |

Part of the **Inari** multi-tenant Internal Developer Platform (GitHub org `7K-Inari`).
Canonical architecture & development plan: [inari-docs/docs/architecture/inari-platform-plan.md](https://github.com/7K-Inari/inari-docs/blob/main/docs/architecture/inari-platform-plan.md)
