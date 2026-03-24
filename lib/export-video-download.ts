const DEFAULT_FILENAME = "clip.mp4";

/**
 * On iOS/Android WebViews (e.g. Whop app), navigating to an MP4 or using
 * `<a download>` usually opens the fullscreen player instead of saving.
 * Those environments should use fetch + Web Share API (Save to Files) instead.
 */
export function shouldUseShareSheetForExport(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") {
    return false;
  }
  const ua = navigator.userAgent || "";
  if (/iPhone|iPod/i.test(ua)) return true;
  if (/iPad/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }
  if (/Android/i.test(ua)) return true;
  try {
    if (window.matchMedia?.("(pointer: coarse)").matches) return true;
  } catch {
    // ignore
  }
  return false;
}

function toAbsoluteUrl(href: string): string {
  if (href.startsWith("http://") || href.startsWith("https://")) {
    return href;
  }
  if (typeof window === "undefined") return href;
  return new URL(href, window.location.origin).href;
}

export type SaveExportedClipResult =
  | { ok: true; method: "share" | "anchor" }
  | { ok: false; message: string };

/**
 * Desktop: triggers a file download via a temporary anchor (no full-file fetch).
 * Mobile / coarse pointer: fetches the MP4 then shares as a File (iOS “Save to Files”)
 * or falls back to object-URL download; if that fails, copies the absolute URL.
 */
export async function saveExportedClipVideo(
  downloadHref: string,
  options?: { filename?: string }
): Promise<SaveExportedClipResult> {
  const filename = options?.filename ?? DEFAULT_FILENAME;
  const absoluteUrl = toAbsoluteUrl(downloadHref);

  if (!shouldUseShareSheetForExport()) {
    const a = document.createElement("a");
    a.href = downloadHref;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return { ok: true, method: "anchor" };
  }

  let res: Response;
  try {
    res = await fetch(absoluteUrl);
  } catch {
    return { ok: false, message: "Network error while preparing the file." };
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return {
      ok: false,
      message: text.slice(0, 160) || `Download failed (${res.status})`,
    };
  }

  let blob: Blob;
  try {
    blob = await res.blob();
  } catch {
    return { ok: false, message: "Could not read the video file." };
  }

  const file = new File([blob], filename, {
    type: blob.type || "video/mp4",
  });

  const shareData: ShareData = {
    files: [file],
    title: "Clip export",
    text: "Save to Files or share your clip",
  };

  try {
    if (
      typeof navigator.canShare === "function" &&
      navigator.canShare({ files: [file] })
    ) {
      await navigator.share(shareData);
      return { ok: true, method: "share" };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: true, method: "share" };
    }
  }

  // Some WebViews support sharing a URL (user can open in Safari and download there).
  try {
    if (typeof navigator.share === "function") {
      await navigator.share({
        title: "Clip export",
        text: "Open in Safari to save the file, or copy the link.",
        url: absoluteUrl,
      });
      return { ok: true, method: "share" };
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      return { ok: true, method: "share" };
    }
  }

  try {
    const obj = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = obj;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(obj);
    return { ok: true, method: "anchor" };
  } catch {
    // last resort
  }

  try {
    await navigator.clipboard.writeText(absoluteUrl);
    return {
      ok: false,
      message:
        "Could not open the save sheet. The download link was copied — open Safari, paste into the address bar, and the video will download.",
    };
  } catch {
    return {
      ok: false,
      message:
        "Saving isn’t supported inside this app’s browser. Open ClipCap in Safari or use a desktop browser to download your clip.",
    };
  }
}
