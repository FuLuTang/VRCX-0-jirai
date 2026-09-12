# VRCX-0-jirai clean port

This branch starts from `vrcx` commit `bd63532d4` (v2.28), rather than
replaying the historical `vrcx-0-jirai` commits. The old repository remains a
read-only implementation reference during the port.

## Compatibility rules

- Keep the `com.vrcx-0.app` bundle identifier, `vrcx-0` deep-link scheme,
  preference keys, and data directory names. Existing local data must stay
  discoverable after the application name changes.
- Reuse the current `vrcx` Feed query API and its current-user scope. Do not
  restore the former custom Feed Rust command or add a Jirai database
  migration.
- Reimplement user-facing features against current `vrcx` components and
  routes. Do not copy removed registries or intermediate old architecture.

## Port scope

1. VRCX-0-jirai branding and the icon set sourced from `vrcx-jirai`.
2. User Bio history diff inside the existing user dialog.
3. Two-person relationship history.
4. Relationship timeline, preserving the original `vrcx-jirai` per-bucket
   Top-N percentage algorithm and controls.
5. The overlay relationship-suggestion extension point.

## Release setup required before publishing

The updater endpoints point at `FuLuTang/VRCX-0-jirai` so this build cannot
silently update itself to `vrcx`. Before publishing the first updater-enabled
release, generate a dedicated Tauri updater signing key and replace the
`plugins.updater.pubkey` value in `src-tauri/tauri.conf.json`; the inherited
public key only trusts release artifacts signed by `vrcx`.
