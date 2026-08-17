# Dependency security policy

Last reviewed: 2026-08-17

## Current controls

- `postcss` is overridden to `8.5.26`, above the patched threshold for the known source-map vulnerabilities. It is not allowlisted.
- `npm run security:assets` rejects ICNS, JXL, HEIF/HEIC, and AVIF files by extension and file signature before Metro can inspect them.
- `npm run security:audit` permits only the three GHSA entries in `security/audit-allowlist.json`.
- A new, unidentified, expired, or resolved-but-still-listed advisory fails the audit gate.
- Exceptions expire at 00:00 UTC on the recorded `expiresOn` date. The current review deadline is 2026-09-30.

The allowlist records root advisories, not every derived package that `npm audit` reports through the same dependency chain. An audit count above zero is therefore expected until upstream packages publish and adopt patched dependencies.

## Accepted temporary exceptions

| Advisory | Package | Reason | Expires |
| --- | --- | --- | --- |
| `GHSA-w3rx-r6r6-pgpr` | `image-size` | Metro build-time path; vulnerable asset formats are blocked. | 2026-09-30 |
| `GHSA-5p2g-fcmc-qvqq` | `image-size` | Metro build-time path; vulnerable asset formats are blocked. | 2026-09-30 |
| `GHSA-w5hq-g745-h8pq` | `uuid` | The build-time `xcode` package calls `uuid.v4()`; the advisory affects v3, v5, and v6 buffer handling. | 2026-09-30 |

## Expo SDK upgrade roadmap

Do not use `npm audit fix --force` to jump SDK versions. Upgrade one Expo SDK at a time so each compatibility break can be isolated:

1. Create a dedicated upgrade branch and preserve the current quality/build baseline.
2. Upgrade SDK 54 to 55, then run `npx expo install --fix` and `npx expo-doctor`.
3. Run the complete quality gate, all-platform Expo export, and native Android/iOS builds.
4. Repeat the same process for SDK 55 to 56.
5. Repeat the same process for SDK 56 to 57.
6. Remove an audit exception only after the lockfile no longer contains the advisory and all checks pass.

Reference: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
