# API type generation

This private npm workspace owns `openapi-typescript@7.13.0` and its compatible
`typescript@5.9.3` compiler API. Applications compile with TypeScript 7.0.2,
which does not expose the generator's required `ts.factory` API.

Keep this workspace beside the application workspaces so its compiler resolution
does not inherit an application compiler. npm resolves the generator's TypeScript
peer dependency using the normal lockfile; no global override is required.

Run the existing root `npm run types` and `npm run types:check` commands. They
still read `backend/contracts/openapi.json` and produce or check
`backend/contracts/client-types.d.ts`. Docker installs only the backend workspace;
the generator is used during repository verification rather than production.
