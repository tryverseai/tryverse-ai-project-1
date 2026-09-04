# Running the test suites

Three suites, three configs:

| Suite | Config | Covers |
|---|---|---|
| Frontend | `vitest.config.ts` (root) | `src/**/*.{test,spec}.{ts,tsx}` — jsdom |
| Convex + backend | `convex/vitest.config.ts` | `convex/**/*.test.ts` + `backend/**/*.test.ts` — edge-runtime, `convex-test` |
| Backend only | `backend/vitest.config.ts` | `backend/src/**/*.test.ts` — node |

## The reliable commands

### CI / Linux / macOS

```bash
# from repo root
bun run test              # frontend
bun run test:convex       # convex + backend
cd backend && bun run test # backend only (subset of the above)
```

### Local on Windows with Bun

The **root** package pins `vitest@^3.2.4`, which has a bug (`File URL path must be an absolute
path`, or silent "0 tests found") when run under Bun on a Windows path that contains a space —
e.g. `C:\Users\Prince Oruma\tvaudit`. The **backend** package pins `vitest@^4.1.11`, which is
unaffected. Run every suite through the backend's v4 binary against the config you want:

```bash
# convex + backend  (verified: 14 files, 145 tests)
"backend/node_modules/.bin/vitest.exe" run --config convex/vitest.config.ts

# frontend  (verified: 3 files, 12 tests)
"backend/node_modules/.bin/vitest.exe" run --config vitest.config.ts

# backend only  (works with either runner)
cd backend && bun run test
```

PowerShell: prepend Bun to `PATH` if `bun` isn't found —
`$env:PATH = "$env:USERPROFILE\.bun\bin;$env:PATH"`.

## Recommendation (not done here — needs a dependency-review pass)

Align the root `vitest` to `^4` so one runner covers all three configs on every platform. This is
a deliberate dependency upgrade with its own breaking-change review (v3 → v4 changed config
defaults and some pool behaviour); it was intentionally left out of the B2B-only refactor.
