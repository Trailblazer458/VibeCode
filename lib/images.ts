// Photos for catalog items, keyed by item or destination id (see lib/data/catalog.ts).
// Files live in public/items/; lib/item-photos.json lists them with their Wikimedia Commons credit
// (full list in public/items/CREDITS.md). Items without a photo fall back to their colour cover,
// so the app never requests an image that isn't there.
import covers from "./cover-photos.json";
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

// Plan cards and plan headers use separate destination photos (public/covers/, credits in
// public/covers/CREDITS.md), never the carousel's, so the same picture doesn't repeat on one screen.
// Which one depends on the trip type, so the same destination looks different across intent rows.
const COVERS = covers as Record<string, ItemPhoto[]>;
// Four photos per destination, spread so the trip types that most often share a feed
// (rest, thrill, celebrate, explore) never show the same picture for the same place.
const NEED_SLOT: Record<string, number> = { rest: 0, thrill: 1, celebrate: 2, explore: 3, reflect: 0, reconnect: 1, indulge: 2, escape: 3, learn: 1 };

export function destCover(destId: string | undefined | null, need: string): ItemPhoto | null {
  const list = (destId && COVERS[destId]) || [];
  if (!list.length) return null;
  return list[(NEED_SLOT[need] ?? 0) % list.length];
}

/** Illustrated stock avatar (DiceBear "Notionists", CC0), stable for the same seed. */
export function avatarUrl(seed: string) {
  return `https://api.dicebear.com/9.x/notionists/svg?seed=${encodeURIComponent(seed)}&backgroundColor=dcebe7,fbe9d4,e7dccb`;
}
