import { hapticFeedback } from "@tma.js/sdk-react";

export function useTmaHaptic() {
  return {
    // Light tap — outcome selection, button press
    tap() {
      if (hapticFeedback.impactOccurred.isAvailable()) {
        hapticFeedback.impactOccurred("light");
      }
    },
    // Selection change — scrolling through choices
    select() {
      if (hapticFeedback.selectionChanged.isAvailable()) {
        hapticFeedback.selectionChanged();
      }
    },
    // Success confirmation — win reveal, payment complete, duel created
    confirm() {
      if (hapticFeedback.notificationOccurred.isAvailable()) {
        hapticFeedback.notificationOccurred("success");
      }
    },
  };
}
