// Photos for catalog items, keyed by item or destination id (see lib/data/catalog.ts).
// Files live in public/items/; lib/item-photos.json lists them with their Wikimedia Commons credit
// (full list in public/items/CREDITS.md). Items without a photo fall back to their colour cover,
// so the app never requests an image that isn't there.
import photos from "./item-photos.json";

export interface ItemPhoto {
  src: string;
  title: string;
  artist: string;
  license: string;
  licenseUrl: string;
  source: string;
}

const PHOTOS = photos as Record<string, ItemPhoto>;

export function itemImage(id: string | undefined | null): ItemPhoto | null {
  return (id && PHOTOS[id]) || null;
}

/** Illustrated stock avatar (DiceBear "Notionists", CC0), stable for the same seed. */
export function avatarUrl(seed: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=dcebe7,fbe9d4,e7dccb`;
}
