import "server-only";

type WhereInput = Record<string, unknown>;

export function withActiveRecord<TWhere extends WhereInput>(where?: TWhere) {
  return {
    ...(where ?? {}),
    deletedAt: null,
  };
}

export function withAvailableFile<TWhere extends WhereInput>(where?: TWhere) {
  return {
    ...(where ?? {}),
    deletedAt: null,
    storagePurgedAt: null,
  };
}

export function activeManuscriptWhere<TWhere extends WhereInput>(
  where?: TWhere,
) {
  return withActiveRecord(where);
}

export function activeJournalWhere<TWhere extends WhereInput>(where?: TWhere) {
  return withActiveRecord(where);
}

export function activeArticleTypeWhere<TWhere extends WhereInput>(
  where?: TWhere,
) {
  return withActiveRecord(where);
}

export function activeEmailTemplateWhere<TWhere extends WhereInput>(
  where?: TWhere,
) {
  return withActiveRecord(where);
}
