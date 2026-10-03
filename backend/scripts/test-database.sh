#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
test_container="sixnations-db-test-$$-${RANDOM}"
cleanup() { docker rm -f "$test_container" >/dev/null 2>&1 || true; }
trap cleanup EXIT

# Isolated synthetic database: no host ports, production secrets or remote migrations.
docker run --name "$test_container" -e POSTGRES_PASSWORD=synthetic_test_only \
  -e POSTGRES_DB=sixnations -d postgres:17.6-bookworm >/dev/null
ready=false
for attempt in {1..60}; do
  if docker exec "$test_container" pg_isready -h 127.0.0.1 -U postgres -d sixnations >/dev/null 2>&1; then
    ready=true
    break
  fi
  sleep 1
done
if [[ "$ready" != true ]]; then
  docker logs "$test_container"
  exit 1
fi

apply() { docker exec -i "$test_container" psql -U postgres -d sixnations -v ON_ERROR_STOP=1 -1 < "$1"; }
apply "$repo_root/backend/supabase/tests/bootstrap.sql"
for migration in "$repo_root"/backend/supabase/migrations/*.sql; do apply "$migration"; done
apply "$repo_root/backend/supabase/seed.sql"
for test_file in "$repo_root"/backend/supabase/tests/*.sql; do
  if [[ "$(basename "$test_file")" != bootstrap.sql ]]; then
    docker exec -i "$test_container" psql -U postgres -d sixnations -v ON_ERROR_STOP=1 < "$test_file"
  fi
done
cd "$repo_root"
WORKER_POSTGRES_TEST_CONTAINER="$test_container" npm run test --workspace backend -- tests/integration/worker-postgres.test.ts tests/integration/api-postgres.test.ts
echo 'PASS: fresh migrations, SQL security/invariants and real API/worker integration.'
