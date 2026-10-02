import { useEffect, useRef, useState } from "react";

const hasFiles = (event: DragEvent) => event.dataTransfer?.types.includes("Files") ?? false;

/**
 * Accept a file dropped anywhere in the window; returns true while a file is dragged over it.
 * File drops never navigate away from the page, even while `enabled` is false.
 */
export function useWindowFileDrop(enabled: boolean, onFile: (file: File) => void): boolean {
  const [dragging, setDragging] = useState(false);
  // Latest values without re-binding the listeners
  const latest = useRef({ enabled, onFile });
  useEffect(() => {
    latest.current = { enabled, onFile };
  });

  useEffect(() => {
    // dragenter / dragleave fire for every child element; count to know when the drag really left
    let depth = 0;

    function onEnter(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth += 1;
      setDragging(true);
    }
    function onOver(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      if (event.dataTransfer) event.dataTransfer.dropEffect = latest.current.enabled ? "copy" : "none";
    }
    function onLeave(event: DragEvent) {
      if (!hasFiles(event)) return;
      depth = Math.max(0, depth - 1);
      if (depth === 0) setDragging(false);
    }
    function onDrop(event: DragEvent) {
      if (!hasFiles(event)) return;
      event.preventDefault();
      depth = 0;
      setDragging(false);
      const file = event.dataTransfer?.files[0];
      if (file && latest.current.enabled) latest.current.onFile(file);
    }

    window.addEventListener("dragenter", onEnter);
    window.addEventListener("dragover", onOver);
    window.addEventListener("dragleave", onLeave);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragenter", onEnter);
      window.removeEventListener("dragover", onOver);
      window.removeEventListener("dragleave", onLeave);
      window.removeEventListener("drop", onDrop);
    };
  }, []);

  return enabled && dragging;
}
