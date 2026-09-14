import { useCallback, useEffect, useRef, useState } from "react";

/**
 * How long a sheet's slide-down runs, in milliseconds.
 *
 * Matches the 0.25s the BottomSheet in `ui/Modal.tsx` has always used — that
 * component got its exit animation first, and every sheet that rolls its own
 * overlay should leave at the same speed rather than each picking a number.
 */
export const SHEET_EXIT_MS = 250;

/** The easing both halves of a sheet's travel use. */
export const SHEET_EASE = "cubic-bezier(0.32, 0.72, 0, 1)";

/**
 * Holds a sheet on screen long enough to animate itself out.
 *
 * A sheet rendered as `{open && <Sheet/>}` cannot animate its own exit: the
 * parent drops it from the tree the instant its state flips, so a slide-down
 * keyframe never gets a frame to run in. This defers the parent's `onClose`
 * until the animation has finished, and reports `closing` in the meantime so
 * the sheet can swap its keyframe.
 *
 * Call `dismiss` everywhere the sheet used to call `onClose` — the backdrop,
 * the X, the escape key. `onClose` itself stays untouched, so parents do not
 * change.
 *
 * IMPORTANT — `shared/` is a duplicated directory, hand-copied into oro-tma and
 * oro-pwa. Edits must be applied to BOTH copies, which must stay identical.
 */
export function useSheetDismiss(open: boolean, onClose: () => void) {
  const [closing, setClosing] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
  };

  // Reopening while a previous exit is still in flight — a fast double tap on
  // the launcher — must not leave the sheet stuck in its leaving state.
  useEffect(() => {
    if (open) {
      clear();
      setClosing(false);
    }
  }, [open]);

  useEffect(() => clear, []);

  const dismiss = useCallback(() => {
    // Already leaving. Without this a second backdrop tap queues a second
    // timeout and `onClose` fires twice.
    if (timer.current) return;

    // Someone who has asked for less motion gets no exit animation, and should
    // not be made to wait out its duration either.
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      onClose();
      return;
    }

    setClosing(true);
    timer.current = setTimeout(() => {
      timer.current = null;
      onClose();
    }, SHEET_EXIT_MS);
  }, [onClose]);

  return { closing, dismiss };
}
