import {
  BookOpen,
  Boxes,
  CheckCircle2,
  Cloud,
  FileClock,
  Grid2X2,
  KeyRound,
  LayoutDashboard,
  Layers,
  Puzzle,
  Server,
  Settings,
  Ship,
  Workflow,
} from "lucide-react";

export interface NavItem {
  label: string;
  path: string;
  icon: React.ComponentType<{ className?: string }>;
}

export interface NavSection {
  title?: string;
  items: NavItem[];
}

export const NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Overview", path: "overview", icon: LayoutDashboard }],
  },
  {
    title: "Deliver",
    items: [
      { label: "Catalog", path: "catalog", icon: BookOpen },
      { label: "Deploys", path: "deploys", icon: Ship },
      { label: "Templates", path: "templates", icon: Layers },
      { label: "Approvals", path: "approvals", icon: CheckCircle2 },
    ],
  },
  {
    title: "Operate",
    items: [
      { label: "Clusters", path: "clusters", icon: Server },
      { label: "Fleet", path: "fleet", icon: Grid2X2 },
      { label: "Cloud Accounts", path: "cloud-accounts", icon: Cloud },
      { label: "Tenant Zones", path: "tenant-zones", icon: Boxes },
    ],
  },
  {
    title: "Govern",
    items: [
      { label: "Platform", path: "platform", icon: Workflow },
      { label: "RBAC", path: "rbac", icon: KeyRound },
      { label: "Audit Log", path: "audit-log", icon: FileClock },
      { label: "Extensions", path: "extensions", icon: Puzzle },
      { label: "Settings", path: "settings", icon: Settings },
    ],
  },
];
