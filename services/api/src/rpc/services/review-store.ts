// Review store — in-memory store for pending review items (stub)

interface ReviewItem {
  proposedTitle: string;
  previewContent: string;
}

const store = new Map<string, ReviewItem>();

export function getReviewItem(id: string): ReviewItem | undefined {
  return store.get(id);
}

export function deleteReviewItem(id: string): void {
  store.delete(id);
}
