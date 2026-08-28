import { useEffect, useRef } from "react";

/**
 * Focus the first focusable text/input field inside a dialog when it opens,
 * without selecting its value. Use this consistently for all add/edit dialogs.
 */
export function useDialogFocus(open: boolean) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !ref.current) return;

    // Wait until the dialog content is rendered and any Radix focus trap settled.
    const timer = setTimeout(() => {
      const container = ref.current;
      if (!container) return;

      const selector =
        'input:not([type="hidden"]):not([type="file"]):not([disabled]), textarea:not([disabled]), select:not([disabled])';
      const firstField = container.querySelector<HTMLElement>(selector);
      if (firstField) {
        firstField.focus({ preventScroll: true });
        // Empty field: caret at start. Field with value: caret behind the text.
        // Date/time inputs keep their own select-all behaviour.
        const el = firstField as HTMLInputElement | HTMLTextAreaElement;
        const isDateOrTime =
          el.tagName === "INPUT" &&
          ["date", "time", "datetime-local", "month", "week"].includes((el as HTMLInputElement).type);
        if (!isDateOrTime && typeof el.setSelectionRange === "function" && el.value) {
          try {
            const end = el.value.length;
            el.setSelectionRange(end, end);
          } catch {
            // some input types don't support selection ranges
          }
        }
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [open]);

  return ref;
}
