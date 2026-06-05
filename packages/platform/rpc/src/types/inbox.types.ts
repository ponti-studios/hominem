export interface InboxStreamItem {
  kind: 'note' | 'chat';
  id: string;
  entityId: string;
  title: string | null;
  preview: string | null;
  updatedAt: string;
}

export type InboxInput = {
  limit?: number;
  cursor?: string;
};

export type InboxOutput = {
  items: InboxStreamItem[];
  nextCursor: string | null;
};
