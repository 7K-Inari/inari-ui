import * as React from "react";
import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { Spinner } from "7k-design-system/react";

import { RequireAuth } from "@/auth/require-auth";
import { ExtensionHostProviders, useSdkSlotContext } from "@/ext/host-context";
import { ExtensionsProvider } from "@/ext/registry";
import { ExtensionPageHost } from "@/ext/slots";
import { ExtensionSsoCallbackPage } from "@/ext/sso-callback";
import { AppShell } from "@/layout/app-shell";
import { TenantProvider, useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";


// Pages are lazy-loaded so the initial bundle only carries the shell.
const AllTenantsHome = React.lazy(() =>
  import("@/pages/overview/all-tenants-home").then((m) => ({ default: m.AllTenantsHome })),
);
const OverviewPage = React.lazy(() =>
  import("@/pages/overview/overview-page").then((m) => ({ default: m.OverviewPage })),
);
const CreateOrganizationPage = React.lazy(() =>
  import("@/pages/organizations/create-organization").then((m) => ({ default: m.CreateOrganizationPage })),
);
const ClusterDetailPage = React.lazy(() =>
  import("@/pages/clusters/cluster-detail").then((m) => ({ default: m.ClusterDetailPage })),
);
const ClusterListPage = React.lazy(() =>
  import("@/pages/clusters/cluster-list").then((m) => ({ default: m.ClusterListPage })),
);
const RegisterWizardPage = React.lazy(() =>
  import("@/pages/clusters/register-wizard").then((m) => ({ default: m.RegisterWizardPage })),
);
const CatalogBrowsePage = React.lazy(() =>
  import("@/pages/catalog/catalog-browse").then((m) => ({ default: m.CatalogBrowsePage })),
);
const CatalogItemDetailPage = React.lazy(() =>
  import("@/pages/catalog/catalog-item-detail").then((m) => ({ default: m.CatalogItemDetailPage })),
);
const DeployWizardPage = React.lazy(() =>
  import("@/pages/catalog/deploy-wizard").then((m) => ({ default: m.DeployWizardPage })),
);
const ExtensionsPage = React.lazy(() =>
  import("@/pages/extensions/extensions-page").then((m) => ({ default: m.ExtensionsPage })),
);
const ClusterSetDetailPage = React.lazy(() =>
  import("@/pages/fleet/clusterset-detail").then((m) => ({ default: m.ClusterSetDetailPage })),
);
const FleetOverviewPage = React.lazy(() =>
  import("@/pages/fleet/fleet-overview").then((m) => ({ default: m.FleetOverviewPage })),
);
const RolloutDetailPage = React.lazy(() =>
  import("@/pages/fleet/rollout-detail").then((m) => ({ default: m.RolloutDetailPage })),
);
const ScaffoldWizardPage = React.lazy(() =>
  import("@/pages/templates/scaffold-wizard").then((m) => ({ default: m.ScaffoldWizardPage })),
);
const TemplateListPage = React.lazy(() =>
  import("@/pages/templates/template-list").then((m) => ({ default: m.TemplateListPage })),
);
const ResourceDetailPage = React.lazy(() =>
  import("@/pages/resources/resource-detail").then((m) => ({ default: m.ResourceDetailPage })),
);
const ResourceListPage = React.lazy(() =>
  import("@/pages/resources/resource-list").then((m) => ({ default: m.ResourceListPage })),
);
const CloudAccountDetailPage = React.lazy(() =>
  import("@/pages/cloud-accounts/cloud-account-detail").then((m) => ({ default: m.CloudAccountDetailPage })),
);
const CloudAccountListPage = React.lazy(() =>
  import("@/pages/cloud-accounts/cloud-account-list").then((m) => ({ default: m.CloudAccountListPage })),
);
const ConnectAccountWizardPage = React.lazy(() =>
  import("@/pages/cloud-accounts/connect-wizard").then((m) => ({ default: m.ConnectAccountWizardPage })),
);
const AccessPage = React.lazy(() =>
  import("@/pages/access/access-page").then((m) => ({ default: m.AccessPage })),
);
const PlatformAccessPage = React.lazy(() =>
  import("@/pages/access/platform-access").then((m) => ({ default: m.PlatformAccessPage })),
);
const PlatformFeatureFlagsPage = React.lazy(() =>
  import("@/pages/access/platform-feature-flags").then((m) => ({ default: m.PlatformFeatureFlagsPage })),
);
const ApprovalsPage = React.lazy(() =>
  import("@/pages/approvals/approvals-page").then((m) => ({ default: m.ApprovalsPage })),
);
const AuditLogPage = React.lazy(() =>
  import("@/pages/audit/audit-log-page").then((m) => ({ default: m.AuditLogPage })),
);
const PlatformPage = React.lazy(() =>
  import("@/pages/platform/platform-page").then((m) => ({ default: m.PlatformPage })),
);
const SettingsLayout = React.lazy(() =>
  import("@/pages/settings/settings-layout").then((m) => ({ default: m.SettingsLayout })),
);
const CompliancePage = React.lazy(() =>
  import("@/pages/settings/policies/compliance").then((m) => ({ default: m.CompliancePage })),
);
const ExemptionsPage = React.lazy(() =>
  import("@/pages/settings/policies/exemptions").then((m) => ({ default: m.ExemptionsPage })),
);
const PolicyPacksPage = React.lazy(() =>
  import("@/pages/settings/policies/packs").then((m) => ({ default: m.PolicyPacksPage })),
);
const ApprovalsConfigPage = React.lazy(() =>
  import("@/pages/settings/policies/approvals-config").then((m) => ({ default: m.ApprovalsConfigPage })),
);
const OidcClientsPage = React.lazy(() =>
  import("@/pages/settings/identity/clients").then((m) => ({ default: m.OidcClientsPage })),
);
const OidcScopesPage = React.lazy(() =>
  import("@/pages/settings/identity/scopes").then((m) => ({ default: m.OidcScopesPage })),
);
const GitSettingsPage = React.lazy(() =>
  import("@/pages/settings/org/git").then((m) => ({ default: m.GitSettingsPage })),
);
const GitConnectionsPage = React.lazy(() =>
  import("@/pages/settings/org/git-connections").then((m) => ({ default: m.GitConnectionsPage })),
);
const OrgProfilePage = React.lazy(() =>
  import("@/pages/settings/org/org-profile").then((m) => ({ default: m.OrgProfilePage })),
);
const IdpBrokeringPage = React.lazy(() =>
  import("@/pages/settings/org/idp").then((m) => ({ default: m.IdpBrokeringPage })),
);
const OrgDomainsPage = React.lazy(() =>
  import("@/pages/settings/org/domains").then((m) => ({ default: m.OrgDomainsPage })),
);
const NotificationsPage = React.lazy(() =>
  import("@/pages/settings/notifications").then((m) => ({ default: m.NotificationsPage })),
);
const VisibilityPage = React.lazy(() =>
  import("@/pages/settings/policies/visibility").then((m) => ({ default: m.VisibilityPage })),
);
const RegistrationTokensPage = React.lazy(() =>
  import("@/pages/settings/tokens/registration-tokens").then((m) => ({ default: m.RegistrationTokensPage })),
);
const EsoStoresPage = React.lazy(() =>
  import("@/pages/settings/tokens/eso-stores").then((m) => ({ default: m.EsoStoresPage })),
);
const VendZoneWizardPage = React.lazy(() =>
  import("@/pages/zones/vend-wizard").then((m) => ({ default: m.VendZoneWizardPage })),
);
const ZoneDetailPage = React.lazy(() =>
  import("@/pages/zones/zone-detail").then((m) => ({ default: m.ZoneDetailPage })),
);
const ZoneListPage = React.lazy(() =>
  import("@/pages/zones/zone-list").then((m) => ({ default: m.ZoneListPage })),
);

function PageFallback() {
  return (
    <div className="wizard-status-pending" aria-busy="true">
      <Spinner size="md" /> Loading…
    </div>
  );
}

function TenantRoutes() {
  return (
    <TenantProvider>
      <ExtensionHostProviders>
        <ExtensionsProvider>
          <AppShell />
        </ExtensionsProvider>
      </ExtensionHostProviders>
    </TenantProvider>
  );
}

function ExtensionPageRoute() {
  const context = useSdkSlotContext();
  return <ExtensionPageHost context={context} />;
}

// Legacy RBAC/member/team settings routes redirect into the Access console
// (M1.W1 Phase A consolidation).
function TenantAccessRedirect({ tab }: { tab: string }) {
  const { tenant } = useParams();
  return <Navigate to={`/${tenant}/access/${tab}`} replace />;
}

// Catch-all redirects must be tenant-absolute: a relative Navigate under a
// "*" route appends to the unmatched path and loops ("/x/overview/overview/…").
function TenantCatchAll({ to }: { to: string }) {
  const { tenant } = useParams();
  return <Navigate to={`/${tenant}/${to}`} replace />;
}

export function AppRoutes() {
  return (
    <RequireAuth>
      <React.Suspense fallback={<PageFallback />}>
      <Routes>
        <Route path="/" element={<Navigate to={`/${ALL_TENANTS}/overview`} replace />} />
        <Route path="/create-organization" element={<CreateOrganizationPage />} />
        <Route path="/:tenant/ext-sso/callback" element={<ExtensionSsoCallbackPage />} />
        <Route path="/platform/access" element={<PlatformAccessPage />} />
        <Route path="/platform/feature-flags" element={<PlatformFeatureFlagsPage />} />
        <Route path="/:tenant" element={<TenantRoutes />}>
          <Route index element={<Navigate to="overview" replace />} />
          <Route
            path="overview"
            element={
              <OverviewOrHome />
            }
          />
          <Route path="catalog" element={<CatalogBrowsePage />} />
          <Route path="catalog/:itemId" element={<CatalogItemDetailPage />} />
          <Route path="catalog/:itemId/deploy" element={<DeployWizardPage />} />
          <Route path="deploys" element={<ResourceListPage />} />
          <Route path="deploys/:instanceId" element={<ResourceDetailPage />} />
          <Route path="clusters" element={<ClusterListPage />} />
          <Route path="clusters/new" element={<RegisterWizardPage />} />
          <Route path="clusters/:clusterId" element={<ClusterDetailPage />} />
          <Route path="fleet" element={<FleetOverviewPage />} />
          <Route path="fleet/clustersets/:clusterSetId" element={<ClusterSetDetailPage />} />
          <Route path="fleet/rollouts/:rolloutId" element={<RolloutDetailPage />} />
          <Route path="cloud-accounts" element={<CloudAccountListPage />} />
          <Route path="cloud-accounts/new" element={<ConnectAccountWizardPage />} />
          <Route path="cloud-accounts/:accountId" element={<CloudAccountDetailPage />} />
          <Route path="platform" element={<PlatformPage />} />
          <Route path="tenant-zones" element={<ZoneListPage />} />
          <Route path="tenant-zones/new" element={<VendZoneWizardPage />} />
          <Route path="tenant-zones/:zoneId" element={<ZoneDetailPage />} />
          <Route path="templates" element={<TemplateListPage />} />
          <Route path="templates/:templateId/scaffold" element={<ScaffoldWizardPage />} />
          <Route path="approvals" element={<ApprovalsPage />} />
          <Route path="audit-log" element={<AuditLogPage />} />
          <Route path="access" element={<Navigate to="members" replace />} />
          <Route path="access/:tab" element={<AccessPage />} />
          <Route path="rbac" element={<Navigate to="access/teams" replace />} />
          <Route path="ext/*" element={<ExtensionPageRoute />} />
          <Route path="extensions" element={<ExtensionsPage />} />
          <Route path="settings" element={<SettingsLayout />}>
            <Route index element={<Navigate to="org/git" replace />} />
            <Route path="org" element={<OrgProfilePage />} />
            <Route path="org/members" element={<TenantAccessRedirect tab="members" />} />
            <Route path="org/teams" element={<TenantAccessRedirect tab="teams" />} />
            <Route path="org/git" element={<GitSettingsPage />} />
            <Route path="org/git-connections" element={<GitConnectionsPage />} />
            <Route path="org/idp" element={<IdpBrokeringPage />} />
            <Route path="org/domains" element={<OrgDomainsPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="identity/clients" element={<OidcClientsPage />} />
            <Route path="identity/scopes" element={<OidcScopesPage />} />
            <Route path="identity/rbac" element={<TenantAccessRedirect tab="teams" />} />
            <Route path="policies/packs" element={<PolicyPacksPage />} />
            <Route path="policies/exemptions" element={<ExemptionsPage />} />
            <Route path="policies/compliance" element={<CompliancePage />} />
            <Route path="policies/visibility" element={<VisibilityPage />} />
            <Route path="policies/approvals" element={<ApprovalsConfigPage />} />
            <Route path="tokens/registration" element={<RegistrationTokensPage />} />
            <Route path="tokens/eso-stores" element={<EsoStoresPage />} />
            <Route path="*" element={<TenantCatchAll to="settings/org/git" />} />
          </Route>
          <Route path="*" element={<TenantCatchAll to="overview" />} />
        </Route>
      </Routes>
      </React.Suspense>
    </RequireAuth>
  );
}

function OverviewOrHome() {
  const { tenant } = useTenant();
  if (tenant === ALL_TENANTS) return <AllTenantsHome />;
  return <OverviewPage />;
}
