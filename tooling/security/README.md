# Dependency security checks

Run `npm run test:tooling`. The root `npm run verify` includes these checks.

## UUID remediation — 3 October 2026

The root manifest scopes `uuid@11.1.1` to `xcode@3.0.1`. Expo's config plugins
use Xcode, whose only UUID call is CommonJS `require('uuid').v4()` without options.
UUID 11 retains CommonJS exports and this API; UUID 12 and newer do not.
The regression tests exercise Xcode's real project-ID generation and reject
undersized UUID v3/v5 output buffers. The buffer check failed before the fix and
passed after it. Remove the override once the parent declares a patched dependency.

The [UUID advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq)
identifies 11.1.1 as fixed. [UUID documentation](https://github.com/uuidjs/uuid)
explains the CommonJS removal starting with version 12. Exact release and export
metadata were rechecked through the live npm registry; Context7 supplied migration
and scoped-override documentation. This is a reviewed transitive security override,
not a major upgrade of Expo or a global override of application dependencies.

## Audit and remaining findings

The baseline audit reported 58 entries (49 high, 9 moderate). The UUID override,
decoder backport, and bounded braces/native signing patches reduce the clean install
to 50 high entries and remove the moderate URI finding. Audit counts are propagated
package entries, not independent vulnerable implementations.
Funding output is informational and no funding setting was changed.

| Dependency | Path/exposure | Why unresolved |
| --- | --- | --- |
| [braces 3.0.3](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) | Tailwind → chokidar/micromatch; build/watch glob patterns. | Local patch bounds structural nesting at 128 levels and rejects cyclic/deep ASTs. npm audit still matches the base semver because no upstream fixed release exists; Tailwind 4 conflicts with NativeWind 4. |
| [node-forge 1.4.0](https://github.com/advisories/GHSA-86w9-cpqp-85rv) | Expo CLI/code-signing certificate tooling. | Local Expo signing code uses Node crypto for certificate, manifest, and CSR verification, rejecting weak/malformed algorithms. Forge remains a parser/key-generation dependency and has no upstream patched release. |
| decode-uri-component | Expo Router → query-string 7. | Vendored official 0.5.0 is exposed through a CommonJS-compatible wrapper, preserving query-string's API; the URI advisory no longer appears in the clean audit. |

Validation after the change: clean npm ci, npm run verify (including both security
checks), npm run verify:frontend, npm ls uuid/typescript, and Expo's read-only online
dependency check passed. Contracts and generated types have no drift. The existing
explicit TypeScript 7 exception remains in Expo's compatibility configuration.
Native builds and browser tests were not rerun for this tooling-only UUID change;
the earlier browser run failed and remains unresolved. Database tests were not
repeated because no application, database, or production backend dependency changed.
