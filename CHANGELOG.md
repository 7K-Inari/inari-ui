# Changelog

## [1.6.0](https://github.com/7K-Inari/inari-ui/compare/v1.5.1...v1.6.0) (2026-09-03)


### Features

* **auth:** drive create-organization visibility from /me/permissions ([38ea9f3](https://github.com/7K-Inari/inari-ui/commit/38ea9f39876f44e4eeca6f220c30c87382939935))
* **auth:** drive create-organization visibility from /me/permissions ([a0f3b59](https://github.com/7K-Inari/inari-ui/commit/a0f3b59992eb5236775b31e0462fedef577b9928))

## [1.5.1](https://github.com/7K-Inari/inari-ui/compare/v1.5.0...v1.5.1) (2026-08-30)


### Bug Fixes

* **ci:** publish chart to repo-scoped GHCR path and make package public ([#26](https://github.com/7K-Inari/inari-ui/issues/26)) ([0fb9925](https://github.com/7K-Inari/inari-ui/commit/0fb992536d1284ecf77cd8b6f1d430ce0d11feb1))

## [1.5.0](https://github.com/7K-Inari/inari-ui/compare/v1.4.0...v1.5.0) (2026-08-28)


### Features

* move inari-console chart from inari-helm-charts ([#23](https://github.com/7K-Inari/inari-ui/issues/23)) ([25a2409](https://github.com/7K-Inari/inari-ui/commit/25a240942a93e4f19eba0b1e1c3ab002675e5b6d))

## [1.4.0](https://github.com/7K-Inari/inari-ui/compare/v1.3.0...v1.4.0) (2026-08-28)


### Features

* **api:** add createTenant helper and MSW POST /tenants mock ([fc035c5](https://github.com/7K-Inari/inari-ui/commit/fc035c55f3c725d3c58fd4b2662b53c69225ae38))
* **auth:** add realm role helpers for platform-admin checks ([4520915](https://github.com/7K-Inari/inari-ui/commit/4520915fcce9e34c42b53f0ecfbb087d5288380b))
* **auth:** add silent org switching via prompt=none re-auth with interactive fallback ([cb3fb56](https://github.com/7K-Inari/inari-ui/commit/cb3fb56ae18da35b5c79f2d939f74d965e144f50))
* **auth:** fall back to interactive login when silent org re-auth fails ([b4caee5](https://github.com/7K-Inari/inari-ui/commit/b4caee5726ae50f79ae9233a09440bbf907de663))
* **auth:** harden organization claim parsing and add hasOrganization helper ([8b25444](https://github.com/7K-Inari/inari-ui/commit/8b25444ad83b51581a5ebd02bce7941f211dd3e7))
* **auth:** multi-organization tenant switching via silent re-authentication ([efaea04](https://github.com/7K-Inari/inari-ui/commit/efaea04066912240fe38160410c0abc537d666ce))
* **clusters:** add deleteCluster API and mock DELETE endpoint for pending registrations ([264e821](https://github.com/7K-Inari/inari-ui/commit/264e82158be99f0f2748a5e0be41abe134b0bfd8))
* **clusters:** add resume and cancel actions for pending clusters on detail page ([30e99c6](https://github.com/7K-Inari/inari-ui/commit/30e99c6cf9466cb723b855effe63093a47653bd4))
* **clusters:** add resume and cancel actions for pending registrations in cluster list ([fc1a188](https://github.com/7K-Inari/inari-ui/commit/fc1a188d79637112a048613c0e12b1ae36bedd63))
* **clusters:** allow fetching a fresh install manifest when resuming registration ([aad6e26](https://github.com/7K-Inari/inari-ui/commit/aad6e263a8bb953271f3c530fa40061f7544446f))
* **clusters:** resume and cancel pending cluster registrations ([ad424cf](https://github.com/7K-Inari/inari-ui/commit/ad424cf173fbd8613fd9468187b683a3cb3e3b55))
* **organizations:** add /create-organization route and platform-admin CTA in tenant switcher ([6324fab](https://github.com/7K-Inari/inari-ui/commit/6324fab22d8ed94f6040f9195c65ab7c6b5722a4))
* **organizations:** add create organization page and platform-admin CTA ([3765467](https://github.com/7K-Inari/inari-ui/commit/3765467667c2b7da84a462517557c5fa99b74aaf))
* **organizations:** add create organization page with slug validation and conflict handling ([20762b4](https://github.com/7K-Inari/inari-ui/commit/20762b499535adc96b8c482e72a47ccbdaaa05a5))
* **tenant:** switch organizations via silent re-authentication ([3e4cb2c](https://github.com/7K-Inari/inari-ui/commit/3e4cb2c75ba89e5753a32fa718142a3884ed843c))


### Bug Fixes

* **auth:** reject empty or whitespace org aliases in parsing and switching ([2330f30](https://github.com/7K-Inari/inari-ui/commit/2330f30ba4f108d637f8d5160796a56e7a2fab6f))
* **clusters:** prefill mandatory chart values in helm install command ([cdd7110](https://github.com/7K-Inari/inari-ui/commit/cdd71102d1b6dcaadc5b527fb4baa53946b482ee))
* **clusters:** prefill mandatory chart values in helm install command ([72ecadb](https://github.com/7K-Inari/inari-ui/commit/72ecadb38fcbd0264895088d916d6c47bd79f735))
* **clusters:** surface error when resuming a registration that no longer exists ([085562d](https://github.com/7K-Inari/inari-ui/commit/085562d84c26d85959fb67261d55ac412c0935d7))
* **organizations:** reject whitespace-only display names, trim before submit ([df8027d](https://github.com/7K-Inari/inari-ui/commit/df8027dca7c8cda266e79d73b8bc4843677c088d))

## [1.3.0](https://github.com/7K-Inari/inari-ui/compare/v1.2.0...v1.3.0) (2026-08-21)


### Features

* runtime console configuration via config.js ([ea68b1e](https://github.com/7K-Inari/inari-ui/commit/ea68b1e65177471b79af563c8a7989e5061b87d3))
* runtime console configuration via config.js ([2e57dc3](https://github.com/7K-Inari/inari-ui/commit/2e57dc35f0690eb7c57148c229ecdf6431c37790))

## [1.2.0](https://github.com/7K-Inari/inari-ui/compare/v1.1.0...v1.2.0) (2026-08-21)


### Features

* **api:** M3 client modules and mocks for cloud accounts, rbac, approvals, audit, platform, zones ([e4a1e24](https://github.com/7K-Inari/inari-ui/commit/e4a1e24b2fe31445d615a0f2b69ceabc8f4bcf3a))
* **api:** typed cluster client, polling hook, and msw mock control plane ([488ffa4](https://github.com/7K-Inari/inari-ui/commit/488ffa4c3a54870af322322eeb7bd79ab32ddcc7))
* app shell with full sidebar IA, header, tenant switcher, and placeholder pages ([7b1fc4b](https://github.com/7K-Inari/inari-ui/commit/7b1fc4b63337a3f84bf4e5515b6e8e2cd3168c49))
* **catalog:** add catalog, deploy and resources API clients with MSW mocks ([8b36af8](https://github.com/7K-Inari/inari-ui/commit/8b36af8a5262ed49fd1e4b4479bf2b6fb9c33b84))
* **catalog:** catalog browse page with source, category and cluster filters ([c5489a9](https://github.com/7K-Inari/inari-ui/commit/c5489a9b786629191ad4b8c913e759399ceabdf8))
* **catalog:** catalog browse, deploy wizard and resources inventory (M2-W2) ([9017083](https://github.com/7K-Inari/inari-ui/commit/9017083d9a3f374eb6d7cbad0ac481ac100d552f))
* **catalog:** catalog item detail with versions, schema preview and policy summary ([3b51ebe](https://github.com/7K-Inari/inari-ui/commit/3b51ebe0d11eb05eba9b4da523f156ccc153379b))
* **catalog:** schema-form renderer with ui-hints and policy transforms ([1714f0c](https://github.com/7K-Inari/inari-ui/commit/1714f0ce26deddffcbab4c37064647a9f1f1b03e))
* **catalog:** wire catalog, deploy wizard and resources routes ([3153d14](https://github.com/7K-Inari/inari-ui/commit/3153d148a5b949c06f2687afce4b98c57e47f83c))
* **cloud-accounts:** account list, AWS connect wizard with trust snippet and dry-run validation ([0310f0d](https://github.com/7K-Inari/inari-ui/commit/0310f0dc3b8d219de84e6b4110e6068d68d07402))
* **clusters:** cluster list, register wizard, and capabilities tab (M1 W2) ([d8f9c3f](https://github.com/7K-Inari/inari-ui/commit/d8f9c3f4c71158b98f331746363fcf0346d76972))
* **clusters:** register wizard with one-time token, install manifest, and live connection wait ([04d737b](https://github.com/7K-Inari/inari-ui/commit/04d737b9e09dc78756c920aa95a1c2e31981023b))
* **clusters:** tenant-scoped cluster list with status filter and empty state ([3776f17](https://github.com/7K-Inari/inari-ui/commit/3776f177c3d12234b37564259c7f809698164981))
* **deploys:** schema-driven deploy wizard with review and live status ([c86e01e](https://github.com/7K-Inari/inari-ui/commit/c86e01e75f34ffdc071aebafba33feba8b7b4cf7))
* **deploys:** surface request-time OPA policy denials with remediation guidance ([2ab4a3a](https://github.com/7K-Inari/inari-ui/commit/2ab4a3a69f76777f16b7a9062a94a6ed8295a119))
* **extensions:** extensions page with registry management ([d06eb03](https://github.com/7K-Inari/inari-ui/commit/d06eb030ae68007a4c5ba6ef4384f5a478e935be))
* **ext:** module federation host runtime and extension registry ([7d9700f](https://github.com/7K-Inari/inari-ui/commit/7d9700f94b7fd032b9d8f5be0387e0374dc6b91c))
* **ext:** wire blueprint slots into shell and pages ([01965fd](https://github.com/7K-Inari/inari-ui/commit/01965fdf2265b21ae76e10b0dbee5ead25511fb5))
* **fleet:** fleet overview, rollout detail with gates, drift, agent channels ([454d19a](https://github.com/7K-Inari/inari-ui/commit/454d19aa8e1365d2085f8b92a985fd016158b705))
* **governance:** approvals inbox/requested with reasoned decisions and filterable exportable audit log ([c0fbc3c](https://github.com/7K-Inari/inari-ui/commit/c0fbc3c53c312a6ce73d098937db451c80f96889))
* M0 app shell with OIDC login and tenant context ([fa7f225](https://github.com/7K-Inari/inari-ui/commit/fa7f2252bae850f0c6962b1d2caf1daa17cfd586))
* **m3:** cloud accounts, RBAC matrix, approvals/audit, platform, tenant zones, policy feedback UX ([7327058](https://github.com/7K-Inari/inari-ui/commit/7327058153aff92cc16717dc440b353b60a5837b))
* module federation host, extension slots, templates & fleet UI (M4-W2) ([ea85abc](https://github.com/7K-Inari/inari-ui/commit/ea85abca08666ed78f2bfb0d92ab7886786e3d83))
* **nav:** wire M3 routes and RBAC nav entry ([ee670f8](https://github.com/7K-Inari/inari-ui/commit/ee670f8644d565291521a50cd0b630fc2fcca1ad))
* OIDC auth with keycloak-js (realm inari, organization scope, token refresh) and tenant context with strict scoping ([f6f6b02](https://github.com/7K-Inari/inari-ui/commit/f6f6b028043fc9ab0c7bb1981ab11f92e5950686))
* **platform:** platform apps and tenant platform resources page ([934acc8](https://github.com/7K-Inari/inari-ui/commit/934acc8ddf7b1ebdb3566ee234356ae8a5dbad04))
* **rbac:** Keycloak group to tenant ClusterRole mapping matrix ([2d7bf20](https://github.com/7K-Inari/inari-ui/commit/2d7bf20e6254392ecd355386445d511bae7f4755))
* **resources:** resources inventory and instance detail ([0b1c371](https://github.com/7K-Inari/inari-ui/commit/0b1c371be859c5c6f3990676ce95b099db86fddc))
* **templates:** templates list and scaffolding wizard ([201cc4f](https://github.com/7K-Inari/inari-ui/commit/201cc4f9228a3f1e215da89a8a195d6b898cf5e1))
* **zones:** tenant zone vend wizard, lifecycle view, approval-gated decommission ([78ab1ad](https://github.com/7K-Inari/inari-ui/commit/78ab1adf216257ad90ace2790c42790da1a52a36))


### Bug Fixes

* align API layer with the real server contract; drop broken MF plugin ([00f1e33](https://github.com/7K-Inari/inari-ui/commit/00f1e33521daa8b835a5093ed7d87831ac3925a3))
* auth init failure handling, org claim parsing, refresh cleanup, mobile nav ([3341058](https://github.com/7K-Inari/inari-ui/commit/3341058fda04034788addb59b91800e5af872b50))
* **deploys:** revert cancelled-flag race in deploy status polling ([359ce64](https://github.com/7K-Inari/inari-ui/commit/359ce645edc2d8b64d5f48ef7f3166daa9f1a3ca))
* **fleet:** wire ClusterSet create/delete UI and stop terminal rollout polling ([994dd66](https://github.com/7K-Inari/inari-ui/commit/994dd66c2220022ef58146cb5c2538939cfc43f8))
* **schema-form:** contain RJSF ui:widget crashes behind a retrying boundary ([5b01814](https://github.com/7K-Inari/inari-ui/commit/5b0181484500ce4328286167271d5027c90414ea))
* **test:** guarantee localStorage in jsdom test environment ([73d88c1](https://github.com/7K-Inari/inari-ui/commit/73d88c1c72b64781400a7cd4aa1b64683cee686f))
* **test:** guarantee localStorage in jsdom test environment ([a789a11](https://github.com/7K-Inari/inari-ui/commit/a789a11dcca2c4990137c65bb1550ded91a89b25))
* **ui:** align API layer with the real server contract; drop broken MF plugin ([cae8b90](https://github.com/7K-Inari/inari-ui/commit/cae8b90665ed30555b3a93f9519d1142fe782813))

## [1.1.0](https://github.com/7K-Inari/inari-ui/compare/v1.0.0...v1.1.0) (2026-08-21)


### Features

* **api:** M3 client modules and mocks for cloud accounts, rbac, approvals, audit, platform, zones ([e4a1e24](https://github.com/7K-Inari/inari-ui/commit/e4a1e24b2fe31445d615a0f2b69ceabc8f4bcf3a))
* **catalog:** add catalog, deploy and resources API clients with MSW mocks ([8b36af8](https://github.com/7K-Inari/inari-ui/commit/8b36af8a5262ed49fd1e4b4479bf2b6fb9c33b84))
* **catalog:** catalog browse page with source, category and cluster filters ([c5489a9](https://github.com/7K-Inari/inari-ui/commit/c5489a9b786629191ad4b8c913e759399ceabdf8))
* **catalog:** catalog browse, deploy wizard and resources inventory (M2-W2) ([9017083](https://github.com/7K-Inari/inari-ui/commit/9017083d9a3f374eb6d7cbad0ac481ac100d552f))
* **catalog:** catalog item detail with versions, schema preview and policy summary ([3b51ebe](https://github.com/7K-Inari/inari-ui/commit/3b51ebe0d11eb05eba9b4da523f156ccc153379b))
* **catalog:** schema-form renderer with ui-hints and policy transforms ([1714f0c](https://github.com/7K-Inari/inari-ui/commit/1714f0ce26deddffcbab4c37064647a9f1f1b03e))
* **catalog:** wire catalog, deploy wizard and resources routes ([3153d14](https://github.com/7K-Inari/inari-ui/commit/3153d148a5b949c06f2687afce4b98c57e47f83c))
* **cloud-accounts:** account list, AWS connect wizard with trust snippet and dry-run validation ([0310f0d](https://github.com/7K-Inari/inari-ui/commit/0310f0dc3b8d219de84e6b4110e6068d68d07402))
* **deploys:** schema-driven deploy wizard with review and live status ([c86e01e](https://github.com/7K-Inari/inari-ui/commit/c86e01e75f34ffdc071aebafba33feba8b7b4cf7))
* **deploys:** surface request-time OPA policy denials with remediation guidance ([2ab4a3a](https://github.com/7K-Inari/inari-ui/commit/2ab4a3a69f76777f16b7a9062a94a6ed8295a119))
* **extensions:** extensions page with registry management ([d06eb03](https://github.com/7K-Inari/inari-ui/commit/d06eb030ae68007a4c5ba6ef4384f5a478e935be))
* **ext:** module federation host runtime and extension registry ([7d9700f](https://github.com/7K-Inari/inari-ui/commit/7d9700f94b7fd032b9d8f5be0387e0374dc6b91c))
* **ext:** wire blueprint slots into shell and pages ([01965fd](https://github.com/7K-Inari/inari-ui/commit/01965fdf2265b21ae76e10b0dbee5ead25511fb5))
* **fleet:** fleet overview, rollout detail with gates, drift, agent channels ([454d19a](https://github.com/7K-Inari/inari-ui/commit/454d19aa8e1365d2085f8b92a985fd016158b705))
* **governance:** approvals inbox/requested with reasoned decisions and filterable exportable audit log ([c0fbc3c](https://github.com/7K-Inari/inari-ui/commit/c0fbc3c53c312a6ce73d098937db451c80f96889))
* **m3:** cloud accounts, RBAC matrix, approvals/audit, platform, tenant zones, policy feedback UX ([7327058](https://github.com/7K-Inari/inari-ui/commit/7327058153aff92cc16717dc440b353b60a5837b))
* module federation host, extension slots, templates & fleet UI (M4-W2) ([ea85abc](https://github.com/7K-Inari/inari-ui/commit/ea85abca08666ed78f2bfb0d92ab7886786e3d83))
* **nav:** wire M3 routes and RBAC nav entry ([ee670f8](https://github.com/7K-Inari/inari-ui/commit/ee670f8644d565291521a50cd0b630fc2fcca1ad))
* **platform:** platform apps and tenant platform resources page ([934acc8](https://github.com/7K-Inari/inari-ui/commit/934acc8ddf7b1ebdb3566ee234356ae8a5dbad04))
* **rbac:** Keycloak group to tenant ClusterRole mapping matrix ([2d7bf20](https://github.com/7K-Inari/inari-ui/commit/2d7bf20e6254392ecd355386445d511bae7f4755))
* **resources:** resources inventory and instance detail ([0b1c371](https://github.com/7K-Inari/inari-ui/commit/0b1c371be859c5c6f3990676ce95b099db86fddc))
* **templates:** templates list and scaffolding wizard ([201cc4f](https://github.com/7K-Inari/inari-ui/commit/201cc4f9228a3f1e215da89a8a195d6b898cf5e1))
* **zones:** tenant zone vend wizard, lifecycle view, approval-gated decommission ([78ab1ad](https://github.com/7K-Inari/inari-ui/commit/78ab1adf216257ad90ace2790c42790da1a52a36))


### Bug Fixes

* align API layer with the real server contract; drop broken MF plugin ([00f1e33](https://github.com/7K-Inari/inari-ui/commit/00f1e33521daa8b835a5093ed7d87831ac3925a3))
* **deploys:** revert cancelled-flag race in deploy status polling ([359ce64](https://github.com/7K-Inari/inari-ui/commit/359ce645edc2d8b64d5f48ef7f3166daa9f1a3ca))
* **fleet:** wire ClusterSet create/delete UI and stop terminal rollout polling ([994dd66](https://github.com/7K-Inari/inari-ui/commit/994dd66c2220022ef58146cb5c2538939cfc43f8))
* **schema-form:** contain RJSF ui:widget crashes behind a retrying boundary ([5b01814](https://github.com/7K-Inari/inari-ui/commit/5b0181484500ce4328286167271d5027c90414ea))
* **test:** guarantee localStorage in jsdom test environment ([73d88c1](https://github.com/7K-Inari/inari-ui/commit/73d88c1c72b64781400a7cd4aa1b64683cee686f))
* **test:** guarantee localStorage in jsdom test environment ([a789a11](https://github.com/7K-Inari/inari-ui/commit/a789a11dcca2c4990137c65bb1550ded91a89b25))
* **ui:** align API layer with the real server contract; drop broken MF plugin ([cae8b90](https://github.com/7K-Inari/inari-ui/commit/cae8b90665ed30555b3a93f9519d1142fe782813))

## 1.0.0 (2026-08-14)


### Features

* **api:** typed cluster client, polling hook, and msw mock control plane ([488ffa4](https://github.com/7K-Inari/inari-ui/commit/488ffa4c3a54870af322322eeb7bd79ab32ddcc7))
* app shell with full sidebar IA, header, tenant switcher, and placeholder pages ([7b1fc4b](https://github.com/7K-Inari/inari-ui/commit/7b1fc4b63337a3f84bf4e5515b6e8e2cd3168c49))
* **clusters:** cluster list, register wizard, and capabilities tab (M1 W2) ([d8f9c3f](https://github.com/7K-Inari/inari-ui/commit/d8f9c3f4c71158b98f331746363fcf0346d76972))
* **clusters:** register wizard with one-time token, install manifest, and live connection wait ([04d737b](https://github.com/7K-Inari/inari-ui/commit/04d737b9e09dc78756c920aa95a1c2e31981023b))
* **clusters:** tenant-scoped cluster list with status filter and empty state ([3776f17](https://github.com/7K-Inari/inari-ui/commit/3776f177c3d12234b37564259c7f809698164981))
* M0 app shell with OIDC login and tenant context ([fa7f225](https://github.com/7K-Inari/inari-ui/commit/fa7f2252bae850f0c6962b1d2caf1daa17cfd586))
* OIDC auth with keycloak-js (realm inari, organization scope, token refresh) and tenant context with strict scoping ([f6f6b02](https://github.com/7K-Inari/inari-ui/commit/f6f6b028043fc9ab0c7bb1981ab11f92e5950686))


### Bug Fixes

* auth init failure handling, org claim parsing, refresh cleanup, mobile nav ([3341058](https://github.com/7K-Inari/inari-ui/commit/3341058fda04034788addb59b91800e5af872b50))
