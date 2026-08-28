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
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [open]);

  return ref;
}
