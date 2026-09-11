import {
  Building2,
  Eye,
  FileCheck2,
  FolderGit2,
  Globe,
  KeyRound,
  ListChecks,
  Scale,
  ScrollText,
  ShieldCheck,
  TicketCheck,
  UserPlus,
  Users,
  Vault,
  Webhook,
} from "lucide-react";

import type { NavItem, NavSection } from "@/layout/nav";

export type SettingsCapability = "viewer" | "admin";

export interface SettingsNavItem extends NavItem {
  path: string;
  requiredCapability: SettingsCapability;
}

export interface SettingsNavSection {
  title: string;
  items: SettingsNavItem[];
}

// Mirrors the Settings IA tree (design §1). `path` is relative to
// /:tenant/settings. requiredCapability gates visibility: entries the user
// cannot read are hidden (design §4).
export const SETTINGS_NAV_SECTIONS: SettingsNavSection[] = [
  {
    title: "Tenant/Org",
    items: [
      { label: "Profile", path: "org", icon: Building2, requiredCapability: "viewer" },
      { label: "Members", path: "org/members", icon: Users, requiredCapability: "viewer" },
      { label: "Teams", path: "org/teams", icon: UserPlus, requiredCapability: "viewer" },
      { label: "Git", path: "org/git", icon: FolderGit2, requiredCapability: "viewer" },
      { label: "IdP Brokering", path: "org/idp", icon: Webhook, requiredCapability: "admin" },
      { label: "Domains", path: "org/domains", icon: Globe, requiredCapability: "viewer" },
    ],
  },
  {
    title: "Identity",
    items: [
      { label: "OIDC Clients", path: "identity/clients", icon: KeyRound, requiredCapability: "admin" },
      { label: "Scopes", path: "identity/scopes", icon: ListChecks, requiredCapability: "admin" },
      { label: "RBAC Mapping", path: "identity/rbac", icon: ShieldCheck, requiredCapability: "admin" },
    ],
  },
  {
    title: "Policies",
    items: [
      { label: "Packs", path: "policies/packs", icon: ScrollText, requiredCapability: "viewer" },
      { label: "Exemptions", path: "policies/exemptions", icon: TicketCheck, requiredCapability: "viewer" },
      { label: "Compliance", path: "policies/compliance", icon: FileCheck2, requiredCapability: "viewer" },
      { label: "Visibility", path: "policies/visibility", icon: Eye, requiredCapability: "viewer" },
      { label: "Approvals", path: "policies/approvals", icon: Scale, requiredCapability: "viewer" },
    ],
  },
  {
    title: "Tokens & Secrets",
    items: [
      { label: "Registration Tokens", path: "tokens/registration", icon: KeyRound, requiredCapability: "viewer" },
      { label: "ESO Stores", path: "tokens/eso-stores", icon: Vault, requiredCapability: "viewer" },
    ],
  },
];

export function visibleSettingsSections(
  isAdmin: boolean,
): NavSection[] {
  return SETTINGS_NAV_SECTIONS.map((section) => ({
    title: section.title,
    items: section.items
      .filter((item) => isAdmin || item.requiredCapability === "viewer")
      .map(({ label, path, icon }) => ({ label, path, icon })),
  })).filter((section) => section.items.length > 0);
}
