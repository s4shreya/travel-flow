import { ExternalLink, Maximize2, Minimize2 } from "lucide-react";
import { useEffect, useState } from "react";

import { getReceiptFile } from "@/api/receipts";
import { Alert } from "@/components/ui/Alert";
import { Loader } from "@/components/ui/Loader";
import { Modal } from "@/components/ui/Modal";
import { errorMessage } from "@/lib/errors";

interface ReceiptViewerProps {
  travelRequestId: string;
  receiptId: number | string;
  /** Shown in the title, e.g. the uploaded file name. */
  name: string;
  onClose: () => void;
}

interface LoadedFile {
  url: string;
  type: string;
}

const iconButton = "rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700";

/** View an uploaded bill (image or PDF) in a modal; maximise to fill the screen. */
export function ReceiptViewer({ travelRequestId, receiptId, name, onClose }: ReceiptViewerProps) {
  const [file, setFile] = useState<LoadedFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [maximised, setMaximised] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    getReceiptFile(travelRequestId, receiptId)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setFile({ url, type: blob.type });
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(errorMessage(err, "Could not open this receipt"));
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [travelRequestId, receiptId]);

  const ToggleIcon = maximised ? Minimize2 : Maximize2;
  const frameHeight = maximised ? "h-full" : "h-[70vh]";

  return (
    <Modal
      title={name}
      onClose={onClose}
      size={maximised ? "full" : "xl"}
      actions={
        <>
          {file ? (
            <a href={file.url} target="_blank" rel="noreferrer" aria-label="Open in new tab" title="Open in new tab" className={iconButton}>
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          ) : null}
          <button
            type="button"
            aria-label={maximised ? "Restore size" : "Maximise"}
            title={maximised ? "Restore size" : "Maximise"}
            onClick={() => setMaximised((value) => !value)}
            className={iconButton}
          >
            <ToggleIcon className="h-4 w-4" aria-hidden />
          </button>
        </>
      }
    >
      {error ? (
        <Alert tone="error">{error}</Alert>
      ) : !file ? (
        <div className="flex h-40 items-center justify-center">
          <Loader label="Loading receipt…" />
        </div>
      ) : file.type === "application/pdf" ? (
        <iframe title={name} src={file.url} className={`w-full rounded-md border border-slate-200 ${frameHeight}`} />
      ) : (
        <div className={`flex items-center justify-center rounded-md bg-slate-50 ${frameHeight}`}>
          <img src={file.url} alt={name} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </Modal>
  );
}
