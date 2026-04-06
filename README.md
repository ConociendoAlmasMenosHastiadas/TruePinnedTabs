# True Pinned Tabs

A tiny Firefox WebExtension that makes your pinned tabs genuinely permanent.

## The problem it solves

Firefox internally tracks pinned tabs through its session store. If the **last window you close has no pinned tabs** (e.g. you closed your main window first, then a utility window that had no pins), Firefox silently forgets them. Next startup they are gone.

This extension solves that by maintaining its **own** persistent record in `storage.local` and restoring any missing pinned tabs every time Firefox starts — **without** requiring "Restore previous session".

## How it works

| Event | Action |
|---|---|
| Tab pinned / unpinned / navigated | Save full pinned-URL list to `storage.local` |
| Tab opened, closed, moved between windows | Save full pinned-URL list |
| `runtime.onStartup` (Firefox starts) | Compare saved list against currently pinned tabs; open any that are missing, pinned, in the first normal window |

`about:` and `moz-extension:` URLs are intentionally excluded — they cannot be meaningfully re-opened.

## Development

### Prerequisites

- PowerShell 5.1+ (built into Windows — nothing to install)
- Firefox Developer Edition or Nightly (for permanent unsigned extension loading)

### Build the XPI

```powershell
.\build.ps1
```

The unsigned XPI is written to `artifacts/true_pinned_tabs-1.0.0.xpi`.

Pass `-Version` to override the version in the filename:

```powershell
.\build.ps1 -Version "1.1.0"
```

No npm, no Node.js, no external tools.

## Installation

### Permanent (recommended) — Firefox Developer Edition or Nightly

1. Open `about:config` and set **`xpinstall.signatures.required`** → `false`.  
   *(This setting is only honoured in Developer Edition and Nightly; it is locked in Release/ESR.)*
2. Open `about:addons` → gear icon → **Install Add-on From File…**
3. Select the `.xpi` from `artifacts/`.

The extension now survives browser restarts permanently.

### Temporary — any Firefox build (for testing)

1. Open `about:debugging` → **This Firefox** → **Load Temporary Add-on…**
2. Select `src/manifest.json`.

The extension unloads when Firefox closes, but it is enough to verify behaviour.

## Tuning the startup delay

Inside `src/background.js` there is:

```js
await new Promise(resolve => setTimeout(resolve, 1200));
```

This 1.2 s pause lets Firefox finish opening its default window before the extension injects pinned tabs. On a fast SSD you can lower it to `800`. On a slow HDD you may need to raise it to `2000`.

## Repository layout

```
src/
  manifest.json   – Extension manifest (MV2)
  background.js   – All extension logic (persistent background script)
package.json      – web-ext build/run/lint scripts
.github/
  workflows/
    build.yml     – CI: builds the XPI and attaches it to every GitHub release
```

## License

MIT
