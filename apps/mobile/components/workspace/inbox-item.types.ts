export type InboxStreamItemData = {
  kind: 'note' | 'chat';
  id: string;
  title: string | null;
  preview: string | null;
  updatedAt: string;
  route: string;
};
