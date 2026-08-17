# PostgreSQL

Keycloak requires a separate `keycloak` database in the same instance.

Create it once after the first `docker compose up`:

```bash
docker compose exec postgres psql -U finance -c "CREATE DATABASE keycloak;"
```

Then restart Keycloak:

```bash
docker compose restart keycloak
```
