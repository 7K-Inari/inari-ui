import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/auth/require-auth";
import { ExtensionHostProviders, useSdkSlotContext } from "@/ext/host-context";
import { ExtensionsProvider } from "@/ext/registry";
import { ExtensionPageHost } from "@/ext/slots";
import { AppShell } from "@/layout/app-shell";
import { AllTenantsHome, PlaceholderPage } from "@/pages/placeholder";
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
import { RbacMatrixPage } from "@/pages/rbac/rbac-matrix";
import { ApprovalsPage } from "@/pages/approvals/approvals-page";
import { AuditLogPage } from "@/pages/audit/audit-log-page";
import { PlatformPage } from "@/pages/platform/platform-page";
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

export function AppRoutes() {
  return (
    <RequireAuth>
      <Routes>
        <Route path="/" element={<Navigate to={`/${ALL_TENANTS}/overview`} replace />} />
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
          <Route path="rbac" element={<RbacMatrixPage />} />
          <Route path="ext/*" element={<ExtensionPageRoute />} />
          <Route path="extensions" element={<ExtensionsPage />} />
          <Route
            path="settings/*"
            element={
              <PlaceholderPage
                title="Settings"
                description="Tenant/Org, Identity, Policies, and Tokens & Secrets."
              />
            }
          />
          <Route path="*" element={<Navigate to="overview" replace />} />
        </Route>
      </Routes>
    </RequireAuth>
  );
}

function OverviewOrHome() {
  const { tenant } = useTenant();
  if (tenant === ALL_TENANTS) return <AllTenantsHome />;
  return (
    <PlaceholderPage
      title="Overview"
      description="Tenant overview: resources, health, and activity."
    />
  );
}
