<!-- BEGIN:nextjs-agent-rules -->
# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data may be outdated; the installed docs are the source of truth.
<!-- END:nextjs-agent-rules -->

JournalPilot implementation notes:

- Read `journalpilot_prd.md` and `implementation_prompt.md` before feature work.
- Build one feature at a time and stop at the feature boundary.
- Use App Router, TypeScript strict mode, Server Actions for mutations, and `proxy.ts` only for lightweight redirects/checks.
- Prisma 7 generated model types use the `*Model` suffix from `src/generated/prisma/client` (for example `UserModel`), while enum values are imported from `src/generated/prisma/enums`.
- `prisma.config.ts` eagerly reads `DIRECT_URL`. For local/CI schema validation without real credentials, run:

```powershell
$env:DATABASE_URL='postgresql://user:pass@localhost:5432/journalpilot'
$env:DIRECT_URL='postgresql://user:pass@localhost:5432/journalpilot'
npx prisma validate
```

- Standard CI/local verification for implemented features: `npm run test`, `npm run lint`, `npm run typecheck`, `npm run build`, then the `prisma validate` command above when real env vars are unavailable.
- External Supabase checks must not be claimed from local code alone. Before storage-heavy or API-exposure features, confirm in the Supabase dashboard/CLI that the `app` schema is not exposed through public APIs and that manuscript storage buckets are private with explicit policies.
- `generateDisplayId` must live in a manuscript-domain module, not `lib/status-machine.ts`; future submission work should call display ID generation and `transitionStatus` in the same transaction.
