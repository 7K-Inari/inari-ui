# Changelog

## [2.0.0](https://github.com/7K-Inari/inari-ui/compare/v1.6.1...v2.0.0) (2026-09-25)


### ⚠ BREAKING CHANGES

* **clusters:** helm-only agent install; drop kubectl manifest from register wizard ([#52](https://github.com/7K-Inari/inari-ui/issues/52))

### Features

* **api:** add caller-scoped listApprovalsInbox for the v1.6.0 aggregate ([265fa8a](https://github.com/7K-Inari/inari-ui/commit/265fa8a72c37af4133585216996f43a3fe4d0742))
* **api:** codegen client types from pinned OpenAPI contract; align UI with the real server surface ([124c300](https://github.com/7K-Inari/inari-ui/commit/124c300b78837c08bc02c89dc4580f9851019e1c))
* **api:** codegen client types from pinned OpenAPI contract; align UI with the real server surface ([b932a46](https://github.com/7K-Inari/inari-ui/commit/b932a46225829e9f19384cf56b793059c2be9fd4))
* **api:** migrate templates client to canonical scaffold-runs endpoints ([#63](https://github.com/7K-Inari/inari-ui/issues/63)) ([4cd47a8](https://github.com/7K-Inari/inari-ui/commit/4cd47a844cce2613d4e69538da47fb21922579b3))
* **audit:** audit-log viewer pagination + typecheck repair ([#65](https://github.com/7K-Inari/inari-ui/issues/65)) ([62cc607](https://github.com/7K-Inari/inari-ui/commit/62cc60717072b4e6495ce75987202bded429215e))
* **clusters:** helm-only agent install; drop kubectl manifest from register wizard ([#52](https://github.com/7K-Inari/inari-ui/issues/52)) ([dd4242c](https://github.com/7K-Inari/inari-ui/commit/dd4242c55a26c0485f3d58bcfa25154326e685fc))
* **overview:** add all-tenants home with org fan-out sections ([911ec98](https://github.com/7K-Inari/inari-ui/commit/911ec98a2695a8d7c732db70be950f94ea6a62fa))
* **overview:** add per-tenant overview page with cluster health and pending approvals cards ([2fe526d](https://github.com/7K-Inari/inari-ui/commit/2fe526dcdf17446a4239bc97f36ad77e1d28cbe7))
* **overview:** add resource health and drift cards to per-tenant overview ([5543500](https://github.com/7K-Inari/inari-ui/commit/5543500a2e2dabe22fbb8de17c44e4d7bfa4fa07))
* **overview:** add resource health and drift cards to per-tenant overview ([3f05f2d](https://github.com/7K-Inari/inari-ui/commit/3f05f2d73df79c96cc16c3a6eac2814be54b378b))
* **overview:** all-tenants home with org fan-out sections ([05552a7](https://github.com/7K-Inari/inari-ui/commit/05552a74c1088dfb52d680d03564bdda3c0bfdbc))
* **overview:** recent activity card, quick-actions gating, inline approve/reject ([84cc16c](https://github.com/7K-Inari/inari-ui/commit/84cc16c715a5ff146d1fdd824f64227f0906f811))
* **overview:** recent activity card, quick-actions gating, inline approve/reject ([31cf439](https://github.com/7K-Inari/inari-ui/commit/31cf4396e9c41f980cf119c646fa0fbc8badef56))
* **overview:** swap all-tenants approvals to the caller-scoped inbox aggregate ([aea46b8](https://github.com/7K-Inari/inari-ui/commit/aea46b877320d82b613166d505ce55b0f65a28df))
* **overview:** swap all-tenants approvals to the caller-scoped inbox aggregate ([3ef19d7](https://github.com/7K-Inari/inari-ui/commit/3ef19d7a62c62f9f71df6549a69976d7f1eae0c4))
* **secret-stores:** tenant-scoped ESO Secret Stores management page ([#64](https://github.com/7K-Inari/inari-ui/issues/64)) ([ae77eeb](https://github.com/7K-Inari/inari-ui/commit/ae77eeb48263d025a1885d9fec81efaa55536aeb))
* **settings:** add IdP brokering page with write-only secret (M6.W6) ([88de849](https://github.com/7K-Inari/inari-ui/commit/88de849017b6e4872d5d5f6bed3cfb637a105a78))
* **settings:** add org domains page with 409 claim-conflict handling (M6.W6) ([8457c9c](https://github.com/7K-Inari/inari-ui/commit/8457c9c2a41132b2e6da271842235629f8d60b82))
* **settings:** add SAML as second IdP provider for SSO brokering (M6.W8) ([4a8ec8c](https://github.com/7K-Inari/inari-ui/commit/4a8ec8c3573c74d92e4dc08d462537a8faa78821))
* **settings:** add SAML as second IdP provider for SSO brokering (M6.W8) ([8991f69](https://github.com/7K-Inari/inari-ui/commit/8991f69f5daf76e9ffb72aaf9769a19fde9456d5))
* **settings:** ESO secret-stores registry screen ([bec113b](https://github.com/7K-Inari/inari-ui/commit/bec113bd7923c26b433d5c0f2ce573b2169bdfa7))
* **settings:** ESO secret-stores registry screen ([fb8c906](https://github.com/7K-Inari/inari-ui/commit/fb8c906f95f01cb905e9f127e8d282ad34678871))
* **settings:** identity and approvals-config screens ([1c20c13](https://github.com/7K-Inari/inari-ui/commit/1c20c13a7c4444bcf5027bebc8480eecee0a928c))
* **settings:** identity and approvals-config screens ([465419e](https://github.com/7K-Inari/inari-ui/commit/465419e7b02a2eb709f21b2024a8440f4457ae37))
* **settings:** IdP brokering + login-routing domains screens (M6.W6) ([7936286](https://github.com/7K-Inari/inari-ui/commit/79362868c25f6088f227de2a6a29ffb09430c556))
* **settings:** org profile, members, teams, visibility, registration tokens screens ([6ae6341](https://github.com/7K-Inari/inari-ui/commit/6ae6341b723700e516f9ccfa1bd1642a74771479))
* **settings:** org profile, members, teams, visibility, registration tokens screens ([e05e283](https://github.com/7K-Inari/inari-ui/commit/e05e2836342ce52c7772bce1115f3bc69efa67b9))
* **settings:** settings subtree scaffold + policies and git screens ([ba590ad](https://github.com/7K-Inari/inari-ui/commit/ba590ad2409e39c5d97e81d59082d2d1535faf48))
* **settings:** settings subtree scaffold + policies and git screens ([df921e3](https://github.com/7K-Inari/inari-ui/commit/df921e3899c9a2021f442e367113be7f0b0b32c0))
* **settings:** tenant notifications settings page ([#50](https://github.com/7K-Inari/inari-ui/issues/50)) ([2b346b5](https://github.com/7K-Inari/inari-ui/commit/2b346b51206f0186338949c33bddd3efa4b11649))


### Bug Fixes

* **auth:** request organization:* scope on login ([#49](https://github.com/7K-Inari/inari-ui/issues/49)) ([5c315fc](https://github.com/7K-Inari/inari-ui/commit/5c315fc436e4a252a2fe7aeac7d44f4da42a6214))
* **build:** use absolute base URL so deep routes load real assets ([f861ccc](https://github.com/7K-Inari/inari-ui/commit/f861ccc4dfb3a58a7a4babe29aad7a74a0a927f2))
* **build:** use absolute base URL so deep routes load real assets ([f58e11b](https://github.com/7K-Inari/inari-ui/commit/f58e11b1396b896e91b337e6661dbd50760c2327))
* **catalog:** show version and channel per item, handle versionless items ([629cff7](https://github.com/7K-Inari/inari-ui/commit/629cff708530ed4139603c9fd9412576b7261e00))
* **catalog:** show version and channel per item, handle versionless items ([2c329ff](https://github.com/7K-Inari/inari-ui/commit/2c329ffed908698babcbeb8baff6e858ff3e745d))
* **clusters:** stop sending description on create — not in the API schema ([22e1fca](https://github.com/7K-Inari/inari-ui/commit/22e1fca25ba65e8ebaefdc86eb996ff7b2773244))
* **clusters:** stop sending description on create — not in the API schema ([4e65c0e](https://github.com/7K-Inari/inari-ui/commit/4e65c0e70103a8148e72e2e4261b9bdfc00abdf1))
* **console:** eliminate intermittent white screens (asset caching + root error boundary) ([4c03450](https://github.com/7K-Inari/inari-ui/commit/4c034504c536fd0ef9f0d0bb2140a90d02e5209e))
* **console:** MF host shares zod+SDK singletons; catalog template badge; container-name derivation ([#59](https://github.com/7K-Inari/inari-ui/issues/59)) ([d579eb1](https://github.com/7K-Inari/inari-ui/commit/d579eb1d0dab94147ad966a2be1e98265147d7d6))
* **console:** stop white-screening on stale cached index.html after deploys ([101e59c](https://github.com/7K-Inari/inari-ui/commit/101e59cb6cd220dfa533a06d6de8fccc18a99da4))
* **extensions:** entryGlobalName for dashed remote names ([#55](https://github.com/7K-Inari/inari-ui/issues/55)) ([fb706df](https://github.com/7K-Inari/inari-ui/commit/fb706dfd8babdec14d9cdb4e182e34dfd54f6fb0))
* **extensions:** load server-served UI remotes; tenant notifications settings page ([#54](https://github.com/7K-Inari/inari-ui/issues/54)) ([dfb8a5d](https://github.com/7K-Inari/inari-ui/commit/dfb8a5dcea2af3779777208cdf374fa00b48a709))
* **overview:** hide all-tenants activity card when every org is forbidden ([fe90f54](https://github.com/7K-Inari/inari-ui/commit/fe90f5489316254c07e55c29a11090af8f45a662))
* **overview:** link drift card to fleet drift tab ([20eda44](https://github.com/7K-Inari/inari-ui/commit/20eda4442a4a2f4e693fced25480be27abbad415))
* **overview:** settle org fan-out entries independently ([2f06040](https://github.com/7K-Inari/inari-ui/commit/2f060401c271140e2bce7e63de6ab1c2d7fae4ed))
* server-driven org capabilities, catalog latest-version selection ([#51](https://github.com/7K-Inari/inari-ui/issues/51)) ([80621eb](https://github.com/7K-Inari/inari-ui/commit/80621ebbf0a36def2d670ab722d8a2f086f95bb1))
* **settings:** QA fixes for expiry display, git form races, and mock id collisions ([68a0b5d](https://github.com/7K-Inari/inari-ui/commit/68a0b5da0b5fad249ccaf76b82c70ebf00ee878e))
* **settings:** scope provider fields to selected type on secret-store save ([129dffa](https://github.com/7K-Inari/inari-ui/commit/129dffa6671b0c0e49dc36b1a92af196ec1bd508))
* **shell:** add root error boundary so render errors degrade gracefully ([bad6828](https://github.com/7K-Inari/inari-ui/commit/bad6828f670b632d191b2d3e9279a09307c2de30))
* **tenants:** align create-tenant payload and envelope with tenancy API ([62cc0be](https://github.com/7K-Inari/inari-ui/commit/62cc0bed0e0ddba1f86d082b2256f244d2a748c3))
* **tenants:** align create-tenant payload and envelope with tenancy API ([399b659](https://github.com/7K-Inari/inari-ui/commit/399b659b1a6971fc3414fcb5f5f11fcf00224dae))


### Code Refactoring

* **api:** migrate platform/rbac/idp/me/secrets adapters to generated OpenAPI types ([#66](https://github.com/7K-Inari/inari-ui/issues/66)) ([30ad56f](https://github.com/7K-Inari/inari-ui/commit/30ad56f7f0702a7588f9c0a6aea508fc0d6bdae8))
* **clusters:** export shared clusterHealth state-to-status helper ([601e389](https://github.com/7K-Inari/inari-ui/commit/601e38920778297d2fc9f7f2d4b9651a71121628))
* **extensions:** type wire shapes from generated OpenAPI schema ([#62](https://github.com/7K-Inari/inari-ui/issues/62)) ([c5f2cae](https://github.com/7K-Inari/inari-ui/commit/c5f2cae538a032ea4a2211dc9e746095b24e5ff6))

## [1.6.1](https://github.com/7K-Inari/inari-ui/compare/v1.6.0...v1.6.1) (2026-09-05)


### Bug Fixes

* **ci:** stop publish race and sync chart extra-files in release PRs ([13ccde5](https://github.com/7K-Inari/inari-ui/commit/13ccde5d00977f635416237e5c4730ae78a89736))
* **ci:** stop publish race and sync chart extra-files in release PRs ([0dbad11](https://github.com/7K-Inari/inari-ui/commit/0dbad116bae1ef634e24967bae45562221c51553))

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
