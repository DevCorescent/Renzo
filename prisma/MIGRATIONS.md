# Migration strategy

## Where this stands

The database was built with `prisma db push` and had **no migration history**, so
`prisma migrate status` reported *"not managed by Prisma Migrate"*. That is fine
for one developer against one database and dangerous the moment a second
environment exists: there is no ordered, reviewable record of how the schema got
to its current shape, and no safe way to apply it elsewhere.

It is now **baselined**. `prisma/migrations/0_init/migration.sql` describes the
whole schema as it stood at baseline time (100 tables, 36 enums), and the
database is marked as already having it.

## How the baseline was created

```bash
# 1. Describe the current schema as SQL. Reads the schema file only — it does not
#    touch the database.
npx prisma migrate diff --from-empty --to-schema prisma/schema.prisma \
  --script -o prisma/migrations/0_init/migration.sql

# 2. Record it as already applied. This writes ONE row to _prisma_migrations and
#    executes NONE of the SQL, which is what makes it safe on a database that
#    already holds live data.
npx prisma migrate resolve --applied 0_init
```

Verified afterwards: `_prisma_migrations` holds `0_init` with
`applied_steps_count = 0`, and every row count was unchanged.

## From here on

**Never run `prisma db push` against an environment that matters again.** It
applies changes with no record, which is exactly the state this baseline exists
to leave behind.

```bash
# Development — edit schema.prisma, then:
npx prisma migrate dev --name add_something

# Staging / production:
npx prisma migrate deploy
```

`migrate deploy` applies only migrations the target has not seen, in order, and
never prompts. It is the command a deploy pipeline should run.

## Bringing up a NEW environment

A fresh database has no `_prisma_migrations`, so `0_init` runs for real and
creates everything:

```bash
npx prisma migrate deploy
npx prisma db seed        # optional, see prisma/seed.ts
```

## A note on this database's connection

The app talks to Neon over the **HTTP serverless driver** (`@prisma/adapter-neon`,
see `lib/db.ts`), while the Prisma **CLI** connects over raw TCP on 5432. When
the Neon compute is suspended the CLI can fail with `P1001` while the application
keeps working, because the HTTP driver wakes the compute and the TCP client does
not wait for it.

If a migration command reports `P1001`, the database is asleep, not broken —
issue any query through the app (or simply retry) and run the command again. A
deploy pipeline should retry `migrate deploy` once for this reason.
