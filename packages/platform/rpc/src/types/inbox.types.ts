export interface InboxStreamItem {
  kind: 'note' | 'chat';
  id: string;
  entityId: string;
  title: string | null;
  preview: string | null;
  updatedAt: string;
}

export type InboxOutput = {
  items: InboxStreamItem[];
};
