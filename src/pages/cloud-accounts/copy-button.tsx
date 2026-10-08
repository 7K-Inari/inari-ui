import * as React from "react";
import { Copy } from "lucide-react";

import { Button } from "7k-design-system/react";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = React.useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } catch {
          // clipboard unavailable (e.g. insecure context)
        }
      }}
    >
      <Copy className="mr-1" /> {copied ? "Copied" : label}
    </Button>
  );
}
