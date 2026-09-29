import { Navigate, Route, Routes, useParams } from "react-router-dom";

import { RequireAuth } from "@/auth/require-auth";
import { ExtensionHostProviders, useSdkSlotContext } from "@/ext/host-context";
import { ExtensionsProvider } from "@/ext/registry";
import { ExtensionPageHost } from "@/ext/slots";
import { ExtensionSsoCallbackPage } from "@/ext/sso-callback";
import { AppShell } from "@/layout/app-shell";
import { AllTenantsHome } from "@/pages/overview/all-tenants-home";
import { OverviewPage } from "@/pages/overview/overview-page";
import { CreateOrganizationPage } from "@/pages/organizations/create-organization";
import { ClusterDetailPage } from "@/pages/clusters/cluster-detail";
import { ClusterListPage } from "@/pages/clusters/cluster-list";
import { RegisterWizardPage } from "@/pages/clusters/register-wizard";
import { CatalogBrowsePage } from "@/pages/catalog/catalog-browse";
import { CatalogItemDetailPage } from "@/pages/catalog/catalog-item-detail";
import { DeployWizardPage } from "@/pages/catalog/deploy-wizard";
import { ExtensionsPage } from "@/pages/extensions/extensions-page";
import { ClusterSetDetailPage } from "@/pages/fleet/clusterset-detail";
import { FleetOverviewPage } from "@/pages/fleet/fleet-overview";
import { RolloutDetailPage } from "@/pages/fleet/rollout-detail";
import { ScaffoldWizardPage } from "@/pages/templates/scaffold-wizard";
import { TemplateListPage } from "@/pages/templates/template-list";
import { ResourceDetailPage } from "@/pages/resources/resource-detail";
import { ResourceListPage } from "@/pages/resources/resource-list";
import { CloudAccountDetailPage } from "@/pages/cloud-accounts/cloud-account-detail";
import { CloudAccountListPage } from "@/pages/cloud-accounts/cloud-account-list";
import { ConnectAccountWizardPage } from "@/pages/cloud-accounts/connect-wizard";
import { AccessPage } from "@/pages/access/access-page";
import { PlatformAccessPage } from "@/pages/access/platform-access";
import { ApprovalsPage } from "@/pages/approvals/approvals-page";
import { AuditLogPage } from "@/pages/audit/audit-log-page";
import { PlatformPage } from "@/pages/platform/platform-page";
import { SettingsLayout } from "@/pages/settings/settings-layout";
import { CompliancePage } from "@/pages/settings/policies/compliance";
import { ExemptionsPage } from "@/pages/settings/policies/exemptions";
import { PolicyPacksPage } from "@/pages/settings/policies/packs";
import { ApprovalsConfigPage } from "@/pages/settings/policies/approvals-config";
import { OidcClientsPage } from "@/pages/settings/identity/clients";
import { OidcScopesPage } from "@/pages/settings/identity/scopes";
import { GitSettingsPage } from "@/pages/settings/org/git";
import { GitConnectionsPage } from "@/pages/settings/org/git-connections";
import { OrgProfilePage } from "@/pages/settings/org/org-profile";
import { IdpBrokeringPage } from "@/pages/settings/org/idp";
import { OrgDomainsPage } from "@/pages/settings/org/domains";
import { NotificationsPage } from "@/pages/settings/notifications";
import { VisibilityPage } from "@/pages/settings/policies/visibility";
import { RegistrationTokensPage } from "@/pages/settings/tokens/registration-tokens";
import { EsoStoresPage } from "@/pages/settings/tokens/eso-stores";
import { VendZoneWizardPage } from "@/pages/zones/vend-wizard";
import { ZoneDetailPage } from "@/pages/zones/zone-detail";
import { ZoneListPage } from "@/pages/zones/zone-list";
import { TenantProvider, useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";

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

export function AppRoutes() {
  return (
    <RequireAuth>
      <Routes>
        <Route path="/" element={<Navigate to={`/${ALL_TENANTS}/overview`} replace />} />
        <Route path="/create-organization" element={<CreateOrganizationPage />} />
        <Route path="/:tenant/ext-sso/callback" element={<ExtensionSsoCallbackPage />} />
        <Route path="/platform/access" element={<PlatformAccessPage />} />
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
            <Route path="*" element={<Navigate to="org/git" replace />} />
          </Route>
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Route>
      </Routes>
    </RequireAuth>
  );
}

function OverviewOrHome() {
  const { tenant } = useTenant();
  if (tenant === ALL_TENANTS) return <AllTenantsHome />;
  return <OverviewPage />;
}
