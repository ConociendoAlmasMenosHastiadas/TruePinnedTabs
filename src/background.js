"use strict";

const STORAGE_KEY = "pinnedTabs";

/**
 * Queries all currently pinned tabs across every window and writes their URLs
 * to extension storage. Skips internal browser pages (about:, moz-extension:).
 * Called on any event that could change the pinned-tab set.
 */
async function savePinnedTabs() {
  try {
    const pinned = await browser.tabs.query({ pinned: true });
    const urls = pinned
      .map(t => t.url)
      .filter(url =>
        url &&
        !url.startsWith("about:") &&
        !url.startsWith("moz-extension:")
      );
    await browser.storage.local.set({ [STORAGE_KEY]: urls });
  } catch (err) {
    console.error("[TruePinnedTabs] savePinnedTabs failed:", err);
  }
}

/**
 * Reads the saved pinned-tab list and opens any URLs not already present as
 * pinned tabs in the first normal browser window.
 * Called once on browser startup via runtime.onStartup.
 */
async function restorePinnedTabs() {
  try {
    const data = await browser.storage.local.get(STORAGE_KEY);
    const saved = data[STORAGE_KEY] || [];
    if (saved.length === 0) return;

    // Give Firefox time to finish creating the initial window/tab.
    // 1200 ms is a conservative buffer; lower if your machine starts quickly.
    await new Promise(resolve => setTimeout(resolve, 1200));

    // Build a set of URLs already open as pinned tabs so we never duplicate.
    const existing = await browser.tabs.query({ pinned: true });
    const presentUrls = new Set(existing.map(t => t.url));

    const windows = await browser.windows.getAll({ windowTypes: ["normal"] });
    if (windows.length === 0) return;
    const targetWindowId = windows[0].id;

    for (const url of saved) {
      if (!presentUrls.has(url)) {
        await browser.tabs.create({ url, pinned: true, windowId: targetWindowId });
        // Track within the loop to avoid races creating the same URL twice.
        presentUrls.add(url);
      }
    }
  } catch (err) {
    console.error("[TruePinnedTabs] restorePinnedTabs failed:", err);
  }
}

// ── Listeners ────────────────────────────────────────────────────────────────

// A new tab was opened — it might have been born pinned.
browser.tabs.onCreated.addListener(savePinnedTabs);

// A tab was closed — it might have been pinned.
// IMPORTANT: skip saves triggered by a window closing. When a window closes,
// onRemoved fires for every tab sequentially AFTER each tab is already gone.
// The last call would query 0 pinned tabs and overwrite our saved list with [].
// We only want to update storage when the user deliberately closes a single tab.
browser.tabs.onRemoved.addListener((_tabId, removeInfo) => {
  if (!removeInfo.isWindowClosing) {
    savePinnedTabs();
  }
});

// A tab was updated — catch pin/unpin toggling.
// Also catch URL changes but ONLY on pinned tabs to avoid a storage write on
// every navigation across every open tab.
browser.tabs.onUpdated.addListener((_id, changeInfo, tab) => {
  if ("pinned" in changeInfo) {
    savePinnedTabs();
  } else if ("url" in changeInfo && tab.pinned) {
    savePinnedTabs();
  }
});

// A tab was moved to a different window — keep storage current.
browser.tabs.onDetached.addListener(savePinnedTabs);
browser.tabs.onAttached.addListener(savePinnedTabs);

// Restore on every cold start of Firefox.
browser.runtime.onStartup.addListener(restorePinnedTabs);

// On first install (or extension update), do an immediate save so any tabs
// that were already pinned before the extension existed are captured right away.
browser.runtime.onInstalled.addListener(savePinnedTabs);
