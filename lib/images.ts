// Photos for catalog items, keyed by item or destination id (see lib/data/catalog.ts).
// Put files in public/items/ and list them here; anything not listed falls back to the
// item's colour cover, so the app never requests an image that isn't there.
export const ITEM_IMAGES: Record<string, string> = {
  // rishikesh: "/items/rishikesh.jpg",
};

export function itemImage(id: string | undefined | null): string | null {
  return (id && ITEM_IMAGES[id]) || null;
}

/** Illustrated stock avatar (DiceBear "Notionists", CC0), stable for the same seed. */
export function avatarUrl(seed: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=dcebe7,fbe9d4,e7dccb`;
}
