import { describe, it, expect } from 'vitest'
import {
  MediaSchema,
  SettingsSchema,
} from '../utils/validation/schemas'

describe('Zod Schemas', () => {
  describe('SettingsSchema', () => {
    it('validates a settings row with optional nullable fields', () => {
      const settings = {
        id: 'settings-1',
        theme: 'light',
        preferencesJson: '{"voice":"on"}',
      }

      expect(SettingsSchema.parse(settings)).toEqual(settings)
    })

    it('allows omitted optional settings fields', () => {
      expect(SettingsSchema.parse({ id: 'settings-1' })).toEqual({
        id: 'settings-1',
      })
    })

    it('rejects a settings row without an id', () => {
      expect(() => SettingsSchema.parse({ theme: 'dark' })).toThrow()
    })
  })

  describe('MediaSchema', () => {
    it('validates a media row with an ISO timestamp', () => {
      const media = {
        id: 'media-1',
        type: 'image',
        localURL: 'file:///tmp/photo.jpg',
        createdAt: '2026-04-02T12:00:00.000Z',
      }

      expect(MediaSchema.parse(media)).toEqual(media)
    })

    it('rejects a media row with a non-ISO timestamp', () => {
      expect(() =>
        MediaSchema.parse({
          id: 'media-1',
          type: 'image',
          localURL: 'file:///tmp/photo.jpg',
          createdAt: 'yesterday',
        }),
      ).toThrow()
    })
  })
})
