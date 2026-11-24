/**
 * Focus the field inside `box` marked `data-autofocus` and select its text,
 * so typing replaces it. Does nothing when no field is marked.
 */
export function focusMarked(box: HTMLElement | null) {
  const field = box?.querySelector<HTMLInputElement>("[data-autofocus]");
  field?.focus();
  field?.select();
}
