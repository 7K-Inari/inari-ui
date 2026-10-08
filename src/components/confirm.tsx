import * as React from "react";
import { Button, Modal } from "7k-design-system/react";

interface ConfirmOptions {
  title: string;
  body: string;
  confirmLabel?: string;
}

// Promise-based destructive-action confirmation rendered as a DS modal.
// Usage: const [confirm, confirmDialog] = useConfirm();
//   if (!(await confirm({ title: "…", body: "…" }))) return;
//   … render {confirmDialog} once in the page tree.
export function useConfirm() {
  const [state, setState] = React.useState<
    (ConfirmOptions & { resolve: (ok: boolean) => void }) | null
  >(null);

  const confirm = React.useCallback(
    (options: ConfirmOptions) =>
      new Promise<boolean>((resolve) => {
        setState({ ...options, resolve });
      }),
    [],
  );

  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };

  const confirmDialog = (
    <Modal open={state !== null} onClose={() => close(false)} aria-label={state?.title}>
      {state && (
        <div className="decision-modal">
          <h2 className="mono-label">{state.title}</h2>
          <p>{state.body}</p>
          <div className="wizard-actions">
            <Button variant="ghost" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => close(true)}>
              {state.confirmLabel ?? "Confirm"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );

  return [confirm, confirmDialog] as const;
}
