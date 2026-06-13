import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../src/generated/prisma/client";

type JournalSeed = {
  articleTypes: Array<{
    description: string;
    name: string;
  }>;
  description: string;
  name: string;
  slug: string;
};

type EmailTemplateSeed = {
  body: string;
  journalSlug?: string;
  name: string;
  slug: string;
  subject: string;
};

const JOURNALS: JournalSeed[] = [
  {
    name: "Journal of Human-Centered AI",
    slug: "human-centered-ai",
    description:
      "Peer-reviewed research on practical, ethical, and usable artificial intelligence systems.",
    articleTypes: [
      {
        name: "Research Article",
        description: "Full-length empirical or theoretical research.",
      },
      {
        name: "Review Article",
        description: "Structured literature review or synthesis.",
      },
      {
        name: "Short Communication",
        description: "Concise report of timely findings.",
      },
    ],
  },
  {
    name: "Open Biomedical Methods",
    slug: "open-biomedical-methods",
    description:
      "Methods, protocols, and reproducibility studies for biomedical research teams.",
    articleTypes: [
      {
        name: "Protocol",
        description: "Stepwise method suitable for replication.",
      },
      {
        name: "Methods Article",
        description: "Detailed presentation of a validated method.",
      },
      {
        name: "Data Descriptor",
        description: "Description of a reusable biomedical dataset.",
      },
    ],
  },
];

const EMAIL_TEMPLATES: EmailTemplateSeed[] = [
  {
    name: "Submission Received",
    slug: "submission-received",
    subject: "We received manuscript {{displayId}}",
    body: "Hello {{authorName}},\n\nWe received {{title}} and will begin the initial editorial checks shortly.\n\nJournalPilot",
  },
  {
    name: "Reviewer Invitation",
    slug: "reviewer-invitation",
    subject: "Review invitation for {{displayId}}",
    body: "Hello {{reviewerName}},\n\nYou have been invited to review {{title}}. Please accept or decline from your reviewer dashboard.\n\nJournalPilot",
  },
  {
    name: "Decision Ready",
    slug: "decision-ready",
    subject: "Decision available for {{displayId}}",
    body: "Hello {{authorName}},\n\nAn editorial decision is available for {{title}}. Please sign in to view the decision letter.\n\nJournalPilot",
  },
  {
    journalSlug: "human-centered-ai",
    name: "Human-Centered AI Initial Check",
    slug: "initial-check-started",
    subject: "{{displayId}} is in initial check",
    body: "Hello {{authorName}},\n\nThe editorial office has started the initial check for {{title}}.\n\nJournal of Human-Centered AI",
  },
];

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run the seed.");
  }

  return new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });
}

async function upsertActiveJournal(
  prisma: PrismaClient,
  seed: Omit<JournalSeed, "articleTypes">,
) {
  const existing = await prisma.journal.findFirst({
    where: {
      deletedAt: null,
      slug: seed.slug,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.journal.update({
      where: { id: existing.id },
      data: {
        description: seed.description,
        isActive: true,
        name: seed.name,
        slug: seed.slug,
      },
    });
  }

  return prisma.journal.create({
    data: {
      description: seed.description,
      isActive: true,
      name: seed.name,
      slug: seed.slug,
    },
  });
}

async function upsertActiveArticleType(
  prisma: PrismaClient,
  journalId: string,
  seed: JournalSeed["articleTypes"][number],
) {
  const existing = await prisma.articleType.findFirst({
    where: {
      deletedAt: null,
      journalId,
      name: seed.name,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.articleType.update({
      where: { id: existing.id },
      data: {
        description: seed.description,
        isActive: true,
        name: seed.name,
      },
    });
  }

  return prisma.articleType.create({
    data: {
      description: seed.description,
      isActive: true,
      journalId,
      name: seed.name,
    },
  });
}

async function upsertActiveEmailTemplate(
  prisma: PrismaClient,
  seed: EmailTemplateSeed,
  journalId: string | null,
) {
  const existing = await prisma.emailTemplate.findFirst({
    where: {
      deletedAt: null,
      journalId,
      slug: seed.slug,
    },
    select: { id: true },
  });

  if (existing) {
    return prisma.emailTemplate.update({
      where: { id: existing.id },
      data: {
        body: seed.body,
        journalId,
        name: seed.name,
        slug: seed.slug,
        subject: seed.subject,
      },
    });
  }

  return prisma.emailTemplate.create({
    data: {
      body: seed.body,
      journalId,
      name: seed.name,
      slug: seed.slug,
      subject: seed.subject,
    },
  });
}

async function seed() {
  const prisma = createPrismaClient();
  const journalsBySlug = new Map<string, { id: string }>();
  const year = new Date().getUTCFullYear();

  try {
    await Promise.all(JOURNALS.map(async (journalSeed) => {
      const journal = await upsertActiveJournal(prisma, {
        description: journalSeed.description,
        name: journalSeed.name,
        slug: journalSeed.slug,
      });

      journalsBySlug.set(journal.slug, { id: journal.id });

      await Promise.all([
        ...journalSeed.articleTypes.map((articleType) =>
          upsertActiveArticleType(prisma, journal.id, articleType),
        ),
        prisma.manuscriptCounter.upsert({
          where: {
            journalId_year: {
              journalId: journal.id,
              year,
            },
          },
          update: {},
          create: {
            journalId: journal.id,
            year,
          },
        }),
      ]);
    }));

    await Promise.all(EMAIL_TEMPLATES.map((template) => {
      const journalId = template.journalSlug
        ? (journalsBySlug.get(template.journalSlug)?.id ?? null)
        : null;

      if (template.journalSlug && !journalId) {
        throw new Error(`Missing seeded journal ${template.journalSlug}.`);
      }

      return upsertActiveEmailTemplate(prisma, template, journalId);
    }));
  } finally {
    await prisma.$disconnect();
  }
}

seed()
  .then(() => {
    console.log("Seeded journals, article types, email templates, and counters.");
  })
  .catch((error: unknown) => {
    console.error("Seed failed.");
    console.error(error);
    process.exit(1);
  });
