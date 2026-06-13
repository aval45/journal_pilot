# Prisma Seed Strategy

Run the seed with:

```bash
npm run db:seed
```

The seed requires `DATABASE_URL` and creates only application reference data:

- Journals
- Article types
- Email templates
- Manuscript counters for the current year

It is intentionally idempotent for active records and does not create production users, manuscripts, reviews, files, or decisions.

Real users must be created through Supabase Auth or the Supabase Admin API first. The application `User.id` must match the Supabase Auth user UUID, so production users should enter `app.User` through the app registration flow, an explicit admin sync/import flow, or a controlled backfill that starts from Supabase Auth identities.

Do not create real production users only through Prisma seed data. A Prisma-only user row has no corresponding Supabase Auth identity and cannot safely authenticate.
