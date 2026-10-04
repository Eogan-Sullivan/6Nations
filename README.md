# Six Nations Fantasy

Backend implementation for the approved 2027 game specification in [Plan.md](Plan.md). Product decisions and delivery sequence are recorded in [documentation/delivery/milestones.md](documentation/delivery/milestones.md) and [decisions.md](documentation/delivery/decisions.md).

The current assignment covers the backend only. Frontend development consumes the generated [OpenAPI contract](backend/contracts/openapi.json) and [TypeScript types](backend/contracts/client-types.d.ts).

Use Node 22.20.0 from `.node-version` and npm 11.21.0 (recorded in `packageManager`), then run:

```sh
npm ci
npm run verify
npm run test:db
npm run replay --workspace backend
```

Application compilation uses TypeScript 7.0.2. The private `tooling/api-types` workspace keeps openapi-typescript 7.13.0 on TypeScript 5.9.3; existing `npm run types` and `npm run types:check` commands delegate to it. Expo dependency checks intentionally exclude TypeScript because SDK 57 recommends 6.0.3; the application compiler is validated separately. npm 12 installation scripts are approved only for the pinned esbuild and optional macOS fsevents versions.

Dependency security overrides and their regression checks are documented in [tooling/security](tooling/security/README.md). `npm run verify` includes `npm run test:tooling`.

Database checks require Docker and create an isolated synthetic PostgreSQL instance without exposed ports. They apply every migration and execute SQL security/publication tests and API/worker integration tests. The instance is removed on exit. Ordinary `npm test` explicitly skips the database integration tests unless their container environment is configured.

For local API/worker execution, supply the variables documented in [backend/.env.example](backend/.env.example) through the environment, then use `npm run dev` and `npm run dev:worker --workspace backend`. A configured development Supabase project is required for authentication and persistence; synthetic PostgreSQL tests do not emulate the hosted Auth service. Never use the worker privileged key as the API publishable key.

See [backend handoff](documentation/delivery/backend-handoff.md) for configuration, deployment and remaining release evidence.
