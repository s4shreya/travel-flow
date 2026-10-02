import { useEffect, useRef, type ReactNode } from "react";

import { Button } from "@/components/ui/Button";
import type { ButtonVariant } from "@/components/ui/buttonStyles";
import { Modal } from "@/components/ui/Modal";

export interface ConfirmOptions {
  title: string;
  body: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ConfirmDialogProps extends ConfirmOptions {
  onCancel: () => void;
  onConfirm: () => void;
  /** Extra input under the body, e.g. a remarks box. */
  children?: ReactNode;
  confirmVariant?: ButtonVariant;
  confirmDisabled?: boolean;
}

/** Modal confirm for irreversible actions; open it via useConfirm(). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onCancel,
  onConfirm,
  children,
  confirmVariant = "primary",
  confirmDisabled = false,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // Focus the safe option; Escape cancels (handled by Modal)
  useEffect(() => {
    // Once on open, so typing in a remarks box keeps focus
    cancelRef.current?.focus();
  }, []);

  return (
    <Modal
      title={title}
      role="alertdialog"
      onClose={onCancel}
      footer={
        <>
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      {body}
      {children ? <div className="mt-3">{children}</div> : null}
    </Modal>
  );
}
