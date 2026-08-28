import { useEffect, useRef } from "react";

export function focusFirstDialogField(container: HTMLElement) {
  const selector =
    'input:not([type="hidden"]):not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';
  const firstField = container.querySelector<HTMLElement>(selector);
  if (!firstField) return;

  firstField.focus({ preventScroll: true });
  const el = firstField as HTMLInputElement | HTMLTextAreaElement;
  const isDateOrTime =
    el.dataset.dialogSelectAll === "true" ||
    (el.tagName === "INPUT" &&
      ["date", "time", "datetime-local", "month", "week"].includes((el as HTMLInputElement).type));

  if (!isDateOrTime && typeof el.setSelectionRange === "function") {
    try {
      const end = el.value.length;
      el.setSelectionRange(end, end);
    } catch {
      // Some input types do not support selection ranges.
    }
  }
}

/**
 * Focus the first focusable text/input field inside a dialog when it opens,
 * without selecting its value. Use this consistently for all add/edit dialogs.
 */
export function useDialogFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !ref.current) return;

    const placeCaret = () => {
      const container = ref.current;
      if (!container) return;
      focusFirstDialogField(container);
    };

    // Run after both the custom dialog and Radix focus handling have settled.
    const timer = window.setTimeout(placeCaret, 0);
    const delayedTimer = window.setTimeout(placeCaret, 60);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(delayedTimer);
    };
  }, [open]);

  return ref;
}
