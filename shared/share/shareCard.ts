import { shareMessage } from "@tma.js/sdk-react";
import { request } from "../api/client";

/**
 * Get a rendered share card into a chat, as an actual image.
 *
 * ── Why this exists ──────────────────────────────────────────────────────────
 *
 * Sharing used to be `navigator.share({ files })` with a text fallback, and it
 * worked on iOS and silently did not on Android. Telegram runs Mini Apps in
 * WKWebView on iOS, where the Web Share API handles files, and in a plain
 * Android WebView, where **`navigator.share` does not exist at all** — Web Share
 * is a Chrome feature, not a WebView one. So every Android user was sharing a
 * bare link, with nothing in the UI to say the image had been dropped.
 *
 * Telegram's own mechanism behaves identically on both platforms: the backend
 * stages the image and mints a prepared inline message, and `shareMessage()`
 * opens the chat picker. The photo arrives with a button under it.
 *
 * The link preview cannot be improved instead — `t.me` is Telegram's own domain
 * and it renders those previews from the bot's profile, never from Open Graph
 * tags, so it is the same generic card for every market. The image has to be a
 * real photo or it is not there at all.
 *
 * Order matters: Telegram first (the only path that works on Android), then the
 * native sheet (right for the PWA and mobile browsers), then text. Each step is
 * only reached when the one before is genuinely unavailable.
 */
export type ShareOutcome = "telegram" | "native" | "text";

export async function shareCard(opts: {
  /** The rendered card. Must be JPEG — Telegram accepts nothing else here. */
  blob: Blob | null;
  /** Message body shown with the image. */
  text: string;
  /** Deep link back into the app. */
  url: string;
  /** Label for the button under the photo. */
  buttonText?: string;
  /** Filename for the native share sheet. */
  fileName?: string;
}): Promise<ShareOutcome> {
  const { blob, text, url, buttonText = "Open on Oro", fileName = "oro.jpg" } = opts;

  // ── 1. Telegram, the only path that works on Android ──────────────────────
  if (blob && isTelegramShareAvailable()) {
    try {
      const base64 = await blobToBase64(blob);
      const { preparedMessageId } = await request<{ preparedMessageId: string }>(
        "/share/card",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            image: base64,
            caption: text,
            buttonText,
            buttonUrl: url,
          }),
        },
      );
      await shareMessage(preparedMessageId);
      return "telegram";
    } catch {
      // Falls through on purpose. This can fail for reasons the user cannot act
      // on — an account with no Telegram id, inline mode off on the bot, a
      // staging request that timed out — and in every one of them a working
      // text share beats an error toast.
    }
  }

  // ── 2. The OS share sheet: correct outside Telegram ───────────────────────
  if (blob && typeof navigator !== "undefined" && navigator.canShare) {
    try {
      const file = new File([blob], fileName, { type: blob.type || "image/jpeg" });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return "native";
      }
    } catch (err) {
      // A user dismissing the sheet is not a failure and must not cascade into
      // opening a second share UI behind them.
      if ((err as { name?: string })?.name === "AbortError") return "native";
    }
  }

  // ── 3. Text ───────────────────────────────────────────────────────────────
  const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(
    url,
  )}&text=${encodeURIComponent(text)}`;
  const tg = (window as any).Telegram?.WebApp?.openTelegramLink;
  if (typeof tg === "function") tg(tgUrl);
  else window.open(tgUrl, "_blank");
  return "text";
}

/**
 * Whether Telegram can send a prepared message for us.
 *
 * `shareMessage` is Mini Apps 8.0; `isAvailable()` covers both "not in Telegram"
 * and "client too old", so an older app falls back rather than tapping a button
 * that does nothing.
 */
export function isTelegramShareAvailable(): boolean {
  try {
    return shareMessage.isAvailable();
  } catch {
    return false;
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // Yields a data: URL; the backend accepts that form as well as bare base64,
    // because this is the shape the canvas naturally produces.
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
