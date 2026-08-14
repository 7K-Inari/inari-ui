import { Navigate, Route, Routes } from "react-router-dom";

import { RequireAuth } from "@/auth/require-auth";
import { AppShell } from "@/layout/app-shell";
import { AllTenantsHome, PlaceholderPage } from "@/pages/placeholder";
import { ClusterDetailPage } from "@/pages/clusters/cluster-detail";
import { ClusterListPage } from "@/pages/clusters/cluster-list";
import { RegisterWizardPage } from "@/pages/clusters/register-wizard";
import { TenantProvider, useTenant } from "@/tenant/tenant-context";
import { ALL_TENANTS } from "@/tenant/tenant-link";

function TenantRoutes() {
  return (
    <TenantProvider>
      <AppShell />
    </TenantProvider>
  );
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
          <Route
            path="catalog"
            element={
              <PlaceholderPage
                title="Catalog"
                description="Browse discovered capabilities and services."
              />
            }
          />
          <Route
            path="catalog/:itemId"
            element={
              <PlaceholderPage
                title="Catalog item"
                description="Capability detail, schema-driven deploy actions arrive in M2."
              />
            }
          />
          <Route
            path="deploys"
            element={
              <PlaceholderPage
                title="Deploys"
                description="Deployments and resources in the active scope."
              />
            }
          />
          <Route path="clusters" element={<ClusterListPage />} />
          <Route path="clusters/new" element={<RegisterWizardPage />} />
          <Route path="clusters/:clusterId" element={<ClusterDetailPage />} />
          <Route
            path="fleet"
            element={
              <PlaceholderPage
                title="Fleet"
                description="Cross-cluster fleet view."
              />
            }
          />
          <Route
            path="cloud-accounts"
            element={
              <PlaceholderPage
                title="Cloud Accounts"
                description="Cloud provider accounts and their discovered capabilities."
              />
            }
          />
          <Route
            path="platform"
            element={
              <PlaceholderPage
                title="Platform"
                description="Platform health, versions, and operators."
              />
            }
          />
          <Route
            path="tenant-zones"
            element={
              <PlaceholderPage
                title="Tenant Zones"
                description="Isolation zones carved out for tenants."
              />
            }
          />
          <Route
            path="templates"
            element={
              <PlaceholderPage
                title="Templates"
                description="Scaffolds and golden-path templates."
              />
            }
          />
          <Route
            path="approvals"
            element={
              <PlaceholderPage
                title="Approvals"
                description="Pending and historical approval requests."
              />
            }
          />
          <Route
            path="audit-log"
            element={
              <PlaceholderPage
                title="Audit Log"
                description="Tenant-scoped audit trail."
              />
            }
          />
          <Route
            path="extensions"
            element={
              <PlaceholderPage
                title="Extensions"
                description="Installed UI and platform extensions."
              />
            }
          />
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
