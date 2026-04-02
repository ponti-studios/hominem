
export interface UpdateNoteInput {
  id: string
  text: string
  category: string
  scheduledFor?: Date | null
  timezone: string
}

export function useUpdateNote() {
  return {
    isPending: false,
    mutateAsync: jest.fn(),
  }
}
