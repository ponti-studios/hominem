export const taskKeys = {
  all: ['tasks'] as const,
  detail: (id: string) => ['tasks', 'detail', id] as const,
} as const;
