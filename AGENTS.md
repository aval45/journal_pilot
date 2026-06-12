<!-- BEGIN:nextjs-agent-rules -->
# Next.js: ALWAYS read docs before coding

Before any Next.js work, find and read the relevant doc in `node_modules/next/dist/docs/`. Your training data may be outdated; the installed docs are the source of truth.
<!-- END:nextjs-agent-rules -->

JournalPilot implementation notes:

- Read `journalpilot_prd.md` and `implementation_prompt.md` before feature work.
- Build one feature at a time and stop at the feature boundary.
- Use App Router, TypeScript strict mode, Server Actions for mutations, and `proxy.ts` only for lightweight redirects/checks.
