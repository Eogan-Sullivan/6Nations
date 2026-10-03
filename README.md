# Six Nations Fantasy

Backend implementation for the approved 2027 game specification in [Plan.md](Plan.md). Product decisions and delivery sequence are recorded in [documentation/delivery/milestones.md](documentation/delivery/milestones.md) and [decisions.md](documentation/delivery/decisions.md).

The current assignment covers the backend only. Frontend development consumes the generated [OpenAPI contract](backend/contracts/openapi.json) and [TypeScript types](backend/contracts/client-types.d.ts).

Use Node from `.node-version`, then run:

```sh
npm ci
npm run verify
npm run test:db
npm run replay --workspace backend
```

Database checks require Docker and create an isolated synthetic PostgreSQL instance without exposed ports. They apply every migration and execute SQL security/publication tests and API/worker integration tests. The instance is removed on exit. Ordinary `npm test` explicitly skips the database integration tests unless their container environment is configured.

For local API/worker execution, supply the variables documented in [backend/.env.example](backend/.env.example) through the environment, then use `npm run dev` and `npm run dev:worker --workspace backend`. A configured development Supabase project is required for authentication and persistence; synthetic PostgreSQL tests do not emulate the hosted Auth service. Never use the worker privileged key as the API publishable key.

See [backend handoff](documentation/delivery/backend-handoff.md) for configuration, deployment and remaining release evidence.
