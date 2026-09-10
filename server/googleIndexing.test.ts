import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { googleIndexingConfigured, reindexJob } from './lib/googleIndexing';

describe('googleIndexing · sin credenciales', () => {
  const prevEmail = process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
  const prevKey = process.env.GOOGLE_INDEXING_PRIVATE_KEY;
  beforeEach(() => {
    delete process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
    delete process.env.GOOGLE_INDEXING_PRIVATE_KEY;
  });
  afterEach(() => {
    if (prevEmail === undefined) delete process.env.GOOGLE_INDEXING_CLIENT_EMAIL;
    else process.env.GOOGLE_INDEXING_CLIENT_EMAIL = prevEmail;
    if (prevKey === undefined) delete process.env.GOOGLE_INDEXING_PRIVATE_KEY;
    else process.env.GOOGLE_INDEXING_PRIVATE_KEY = prevKey;
  });

  it('googleIndexingConfigured() es false', () => {
    expect(googleIndexingConfigured()).toBe(false);
  });

  it('reindexJob() sale temprano sin tocar BD ni red', async () => {
    await expect(reindexJob('cualquier-slug')).resolves.toEqual({ ok: false, skipped: true });
  });
});
