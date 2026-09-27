import { Badge } from "@/components/ui/badge";
import type { TemplateScope } from "@/api/types";

// Template identity scope (W6): user-scope templates commit as the runner's
// personal git login and are badged distinctly from platform-scope templates.
export function TemplateScopeBadge({ scope }: { scope: TemplateScope }) {
  return scope === "user" ? (
    <Badge variant="warning">Personal git</Badge>
  ) : (
    <Badge variant="secondary">Platform</Badge>
  );
}
