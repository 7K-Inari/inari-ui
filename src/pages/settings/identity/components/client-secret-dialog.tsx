import * as React from "react";

import type { ClientSecret } from "@/api/identity";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// One-time secret display: shown once after client create/rotate and never
// retrievable again, so the copy affordance is front and center.
export function ClientSecretDialog({
  secret,
  onClose,
}: {
  secret: ClientSecret;
  onClose: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.secret);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  return (
    <Card role="dialog" aria-label="Client secret" className="border-primary/50">
      <CardContent className="space-y-3 py-4">
        <div className="space-y-1">
          <h2 className="text-sm font-medium">Client secret — shown once</h2>
          <p className="text-xs text-muted-foreground">
            Copy this secret now. It cannot be retrieved again after you close this
            dialog.
          </p>
        </div>
        <code className="block rounded-md bg-muted px-3 py-2 font-mono text-xs break-all">
          {secret.secret}
        </code>
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={copy}>
            {copied ? "Copied" : "Copy secret"}
          </Button>
          <Button onClick={onClose}>Done</Button>
        </div>
      </CardContent>
    </Card>
  );
}
