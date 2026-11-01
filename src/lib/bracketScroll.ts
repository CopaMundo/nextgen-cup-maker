/** Align vertically only: never changes another bracket's horizontal position. */
export function alignBracketTop(element: HTMLElement) {
  element.scrollTop = 0;
  let parent = element.parentElement;
  while (parent && parent !== document.body && parent !== document.documentElement) {
    const style = getComputedStyle(parent);
    if (/(auto|scroll)/.test(style.overflowY) && parent.scrollHeight > parent.clientHeight) {
      const inset = parseFloat(style.scrollPaddingTop) || 8;
      const delta = element.getBoundingClientRect().top - parent.getBoundingClientRect().top - parent.clientTop - inset;
      if (delta < 0) parent.scrollTop += delta;
    }
    parent = parent.parentElement;
  }
  const inset = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 16;
  const top = element.getBoundingClientRect().top;
  if (top < inset) window.scrollBy({ top: top - inset, behavior: "instant" });
}