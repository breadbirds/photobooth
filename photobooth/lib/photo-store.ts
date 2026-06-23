type StoredPhoto = {
  buffer: Uint8Array;
  contentType: string;
};

const photoStore = globalThis as typeof globalThis & {
  __photoStore?: Map<string, StoredPhoto>;
};

const store = photoStore.__photoStore ?? new Map<string, StoredPhoto>();

photoStore.__photoStore = store;

export function storePhoto(buffer: Uint8Array, contentType = "image/jpeg") {
  const photoId = crypto.randomUUID();

  store.set(photoId, {
    buffer,
    contentType,
  });

  return photoId;
}

export function getPhoto(photoId: string) {
  return store.get(photoId) ?? null;
}