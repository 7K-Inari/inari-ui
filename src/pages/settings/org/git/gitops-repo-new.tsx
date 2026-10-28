import { Badge, Button, Card } from "7k-design-system/react";

import { SettingsSectionHeader } from "@/pages/settings/components/section-header";

const BUILT_IN_TEMPLATES = [
  {
    name: "gitops-repo",
    description:
      "Baseline GitOps state repo with root Application, apps/, clusters/, and policies/ layout.",
  },
  {
    name: "gitops-repo-with-argocd-project",
    description:
      "Baseline repo plus an ArgoCD AppProject for team isolation and RBAC.",
  },
];

export function GitOpsRepoNewPage() {
  return (
    <div className="space-y-4">
      <SettingsSectionHeader
        title="New GitOps Repository"
        description="Provision a new GitOps state repository from a template."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {BUILT_IN_TEMPLATES.map((t) => (
          <Card key={t.name}>
            <div className="card-body space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-brand-primary">{t.name}</h3>
                <Badge variant="neutral">Built-in</Badge>
              </div>
              <p className="text-sm u-muted">{t.description}</p>
              <Button variant="accent" disabled>
                Use Template
              </Button>
            </div>
          </Card>
        ))}
      </div>
      <p className="text-sm u-muted">More templates coming in M2.</p>
    </div>
  );
}
