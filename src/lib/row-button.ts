import type { KeyboardEvent } from "react";

interface KeyTrigger {
  onKeyDown(event: KeyboardEvent<Element>): void;
}

/**
 * Makes a list row keyboard-operable: Enter/Space on the row itself clicks it; every key still reaches the
 * trigger's own handler. Spread after the trigger props, since it replaces their `onKeyDown`.
 */
export function rowButtonProps(
  getTrigger: () => KeyTrigger,
): { role: "button"; tabIndex: 0; onKeyDown(event: KeyboardEvent<HTMLElement>): void } {
  return {
    role: "button",
    tabIndex: 0,
    onKeyDown(event) {
      getTrigger().onKeyDown(event);
      if (event.target !== event.currentTarget || (event.key !== "Enter" && event.key !== " ")) return;
      event.preventDefault();
      event.currentTarget.click();
    },
  };
}
