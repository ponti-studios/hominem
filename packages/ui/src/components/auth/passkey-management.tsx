import { KeyRound, Plus, Trash2 } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "../button";

export interface PasskeyRecord {
  id: string;
  name?: string;
  createdAt?: string;
}

export interface PasskeyManagementProps {
  passkeys?: PasskeyRecord[];
  isLoading?: boolean;
  error?: string | null;
  onAdd: () => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}

export function PasskeyManagement({
  passkeys: passkeysProp,
  isLoading = false,
  error: externalError,
  onAdd,
  onDelete,
}: PasskeyManagementProps) {
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const passkeys = passkeysProp ?? [];
  const error = externalError ?? actionError;

  const handleAdd = useCallback(async () => {
    setAdding(true);
    setActionError(null);
    try {
      const success = await onAdd();
      if (!success) {
        setActionError("Passkey registration was cancelled or failed.");
      }
    } catch {
      setActionError("An error occurred during passkey registration.");
    } finally {
      setAdding(false);
    }
  }, [onAdd]);

  const handleDelete = useCallback(
    async (id: string) => {
      setDeletingId(id);
      setActionError(null);
      try {
        const success = await onDelete(id);
        if (!success) {
          throw new Error("Failed to delete passkey");
        }
      } catch {
        setActionError("Could not delete passkey. Please try again.");
      } finally {
        setDeletingId(null);
      }
    },
    [onDelete],
  );

  return (
    <section aria-labelledby="passkey-heading" className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 id="passkey-heading" className="subheading-4 text-text-primary">
            Passkeys
          </h2>
          <p className="body-3 text-text-secondary">
            Sign in without a password using biometrics or a security key.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => void handleAdd()}
          disabled={adding}
          aria-label="Add a passkey"
        >
          <Plus className="size-4" aria-hidden />
          {adding ? "Adding..." : "Add passkey"}
        </Button>
      </div>

      {error ? (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      ) : null}

      {isLoading ? (
        <p className="text-muted-foreground text-sm">Loading passkeys...</p>
      ) : passkeys.length === 0 ? (
        <div className="border-default text-text-secondary flex items-center gap-3 border border-dashed p-4 text-sm">
          <KeyRound className="size-4 shrink-0" aria-hidden />
          <span>No passkeys registered. Add one to sign in faster.</span>
        </div>
      ) : (
        <ul className="space-y-2" aria-label="Registered passkeys">
          {passkeys.map((pk) => (
            <li
              key={pk.id}
              className="border-default flex items-center justify-between border px-4 py-3 text-sm"
            >
              <div className="flex items-center gap-3">
                <KeyRound className="text-text-secondary size-4 shrink-0" aria-hidden />
                <div>
                  <span className="font-medium">{pk.name ?? "Passkey"}</span>
                  {pk.createdAt ? (
                    <span className="text-text-tertiary ml-2 text-xs">
                      Added {new Date(pk.createdAt).toLocaleDateString()}
                    </span>
                  ) : null}
                </div>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(pk.id)}
                disabled={deletingId === pk.id}
                aria-label={`Remove passkey ${pk.name ?? pk.id}`}
                className="hover:text-destructive text-muted-foreground focus-visible:ring-ring rounded-sm focus-visible:ring-2 focus-visible:outline-none disabled:opacity-50"
              >
                <Trash2 className="size-4" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
