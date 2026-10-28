import * as React from "react";
import { Alert, Button, Input, Modal, Radio } from "7k-design-system/react";

import { ApiError } from "@/api/client";
import { unregisterGitRepo, type GitRepoViewModel } from "@/api/git-repos";
import { useAuth } from "@/auth/auth-context";
import { useTenant } from "@/tenant/tenant-context";

export interface DeleteRepoModalProps {
  repo: GitRepoViewModel | null;
  onClose: () => void;
  onDeleted: () => void;
}

type DeleteVariant = "orphan" | "teardown";

export function DeleteRepoModal({ repo, onClose, onDeleted }: DeleteRepoModalProps) {
  const { token } = useAuth();
  const { tenant } = useTenant();
  const [variant, setVariant] = React.useState<DeleteVariant>("orphan");
  const [confirmText, setConfirmText] = React.useState("");
  const [deleting, setDeleting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [blockedInfo, setBlockedInfo] = React.useState<string | null>(null);
  const [acknowledgedBlock, setAcknowledgedBlock] = React.useState(false);

  React.useEffect(() => {
    if (repo) {
      setVariant("orphan");
      setConfirmText("");
      setError(null);
      setBlockedInfo(null);
      setAcknowledgedBlock(false);
    }
  }, [repo]);

  if (!repo) return null;

  const attemptDelete = async (force: boolean, mode?: "orphan" | "teardown") => {
    setDeleting(true);
    setError(null);
    try {
      await unregisterGitRepo(token, tenant, repo.id, { force, mode });
      onDeleted();
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setBlockedInfo(err.message);
        setAcknowledgedBlock(true);
      } else {
        setError(err instanceof ApiError ? err.message : "Failed to delete repo");
      }
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (variant === "teardown") {
      if (confirmText !== repo.name) {
        setError(`Type "${repo.name}" to confirm`);
        return;
      }
      void attemptDelete(true, "teardown");
    } else {
      // If we've already seen a blocked warning, the user is explicitly
      // re-attempting with force.
      void attemptDelete(acknowledgedBlock, "orphan");
    }
  };

  // If we got a 409, show the blocked variant
  if (blockedInfo) {
    return (
      <Modal open={repo !== null} onClose={onClose} aria-label="Cannot delete repository">
        <div className="modal-header">
          <h2 className="text-xl font-semibold">Cannot Delete Repository</h2>
        </div>
        <div className="modal-body">
          <Alert variant="warning">{blockedInfo}</Alert>
          <div className="modal-actions">
            <Button variant="primary" onClick={() => setBlockedInfo(null)}>
              Understood
            </Button>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal open={repo !== null} onClose={onClose} aria-label="Delete repository">
      <div className="modal-header">
        <h2 className="text-xl font-semibold">
          Delete Repository ({variant === "orphan" ? "Orphan" : "Teardown"})
        </h2>
      </div>
      <div className="modal-body">
        {variant === "orphan" ? (
          <Alert variant="info">
            Orphan mode unregisters the repo from Inari. Running workloads keep
            operating but are no longer managed.
          </Alert>
        ) : (
          <Alert variant="danger">
            Teardown deletes all workloads and ArgoCD apps managed by this repo.
            This action cannot be undone.
          </Alert>
        )}
        <div className="space-y-3">
          <div className="flex gap-4">
            <Radio
              id="delete-orphan"
              name="delete-mode"
              label="Orphan"
              checked={variant === "orphan"}
              onChange={() => setVariant("orphan")}
            />
            <Radio
              id="delete-teardown"
              name="delete-mode"
              label="Teardown"
              checked={variant === "teardown"}
              onChange={() => setVariant("teardown")}
            />
          </div>
          {variant === "teardown" && (
            <div className="space-y-1.5">
              <label className="form-label" htmlFor="confirm-name">
                Type &quot;{repo.name}&quot; to confirm
              </label>
              <Input
                id="confirm-name"
                value={confirmText}
                onChange={(v) => setConfirmText(v)}
                placeholder={repo.name}
              />
            </div>
          )}
          {error && <p className="text-sm u-danger">{error}</p>}
          <div className="modal-actions">
            <Button variant="ghost" onClick={onClose} type="button">
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={deleting || (variant === "teardown" && confirmText !== repo.name)}
            >
              {deleting
                ? "Deleting…"
                : variant === "orphan"
                  ? "Delete Repo"
                  : "Teardown"}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
