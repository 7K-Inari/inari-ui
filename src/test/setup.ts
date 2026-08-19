import "@testing-library/jest-dom/vitest";

import { setCurrentTenant } from "@/tenant/current";

// API helpers resolve the active tenant from this module-level holder (the
// TenantProvider keeps it in sync in the app; most page tests render pages
// without it). Default to the fixture tenant used across the test suite.
setCurrentTenant("acme");
