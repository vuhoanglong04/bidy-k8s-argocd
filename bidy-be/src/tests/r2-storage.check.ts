/**
 * Smallest runnable check for the files/presign storage path.
 *
 *   npx tsx src/tests/r2-storage.check.ts
 *
 * The regression this guards is the invariant the whole `files` table exists for:
 * a URL is never persisted, only the R2 object key, and every URL handed out is a
 * short-lived presigned one derived from that key. Persisting a URL again would
 * either expose the private bucket or write links that die within the hour.
 *
 * It also pins avatar replacement: updateAvatar must repoint the user at the new
 * file and drop the superseded object, or the old avatar stays billable forever.
 *
 * The S3 client is stubbed at the transport layer (requestHandler) — no network,
 * no credentials, no bucket.
 */
import assert from 'node:assert/strict';

process.env.BUCKET_NAME = 'test-bucket';
process.env.R2_ENDPOINT = 'https://acct.r2.cloudflarestorage.com';
process.env.ACCESS_KEY_ID = 'test-key';
process.env.SECRET_ACCESS_KEY = 'test-secret';

async function main() {
  // Imported after env is set: the module reads configuration at load time.
  const { s3, uploadFileToS3 } = await import('../config/r2.config.js');
  const { FileService } = await import('../modules/file/file.service.js');

  // Stub the transport so send() resolves without touching the network.
  const sent: any[] = [];
  (s3 as any).config.requestHandler = {
    handle: (request: any) => {
      sent.push(request);
      return Promise.resolve({
        response: {
          statusCode: 200,
          headers: { etag: '"stub-etag"' },
          body: undefined,
        },
      });
    },
  };

  const file = {
    originalname: 'My Photo (1).PNG',
    mimetype: 'image/png',
    buffer: Buffer.from('stub'),
  };

  // --- upload result carries a key, never a URL -------------------------------
  const result: any = await uploadFileToS3(file, 'products');

  assert.equal(result.url, undefined, 'upload must not hand back a URL to persist');
  assert.match(result.key, /^products\/\d+_[a-z0-9]+_my_photo_1_\.png$/, 'key shape changed');
  assert.equal(result.etag, '"stub-etag"');
  assert.equal(result.size, file.buffer.length, 'size must be recorded for the files row');
  assert.equal(sent.length, 1, 'expected exactly one PutObject request');

  // --- FileService registers the key and signs on read ------------------------
  const rows: any[] = [];
  const fileRepo = {
    create: (data: any) => ({ ...data }),
    save: async (data: any) => {
      const saved = (Array.isArray(data) ? data : [data]).map((row, index) => ({
        id: String(rows.length + index + 1),
        ...row,
      }));
      rows.push(...saved);
      return Array.isArray(data) ? saved : saved[0];
    },
    findOne: async ({ where }: any) => rows.find((row) => row.id === String(where.id)) ?? null,
    find: async () => rows,
    delete: async () => ({ affected: 1 }),
  } as any;

  // The provider builds its singleton from AppDataSource at import time, so the
  // repository is swapped before that import rather than patched afterwards —
  // ESM bindings are read-only once bound.
  const { AppDataSource } = await import('../database/data-source.js');
  (AppDataSource as any).getRepository = () => fileRepo;

  const fileService = new FileService(fileRepo);

  sent.length = 0;
  const registered = await fileService.createFromUpload(file as any, 'products', '7');

  assert.ok(registered.s3Key.startsWith('products/'), 'the object key must be persisted');
  assert.equal((registered as any).url, undefined, 'a files row must never carry a URL column');
  assert.equal(registered.mimeType, 'image/png');
  assert.equal(registered.uploadedBy, '7');

  const signed = await fileService.urlOf(registered);
  assert.ok(signed, 'a stored file must presign to a URL');
  assert.ok(
    signed!.includes(encodeURIComponent(registered.s3Key).replace(/%2F/g, '/')),
    'the signed URL must address the stored key',
  );
  assert.match(signed!, /X-Amz-Signature=/, 'the URL must be presigned, not a bare object URL');
  assert.match(signed!, /X-Amz-Expires=3600/, 'presigned URLs must expire');

  assert.equal(await fileService.urlOf(null), null, 'a missing file presigns to null, not a broken URL');

  // --- avatar replacement -----------------------------------------------------
  const { UserService } = await import('../modules/user/user.service.js');

  const previous = { id: '99', s3Key: 'avatars/old.png' };
  const stored: any = { id: '7', avatarFileId: '99', avatarFile: previous };
  const userRepo = {
    findOne: async () => stored,
    save: async (user: any) => Object.assign(stored, user),
  } as any;

  sent.length = 0;
  const avatar = await new UserService(userRepo, null as any, null as any, null as any, null as any)
    .updateAvatar('7', { ...file, originalname: 'new.png' });

  assert.notEqual(stored.avatarFileId, '99', 'the user must point at the new file row');
  assert.ok(stored.avatarFile.s3Key.startsWith('avatars/'), 'the new avatar key must be persisted');
  assert.match(avatar.avatar!, /X-Amz-Signature=/, 'the returned avatar must be a presigned URL');

  const deletes = sent.filter((r) => r.method === 'DELETE');
  assert.equal(deletes.length, 1, 'the replaced avatar object must be deleted exactly once');
  assert.match(deletes[0].path, /avatars\/old\.png$/, 'the delete must target the previous key');

  console.log('r2-storage.check.ts: all assertions passed');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
