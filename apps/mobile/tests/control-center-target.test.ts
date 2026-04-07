const path = require('path')
const fs = require('fs')

const controlCenterTargetConfig = require('../targets/control-center/expo-target.config.js') as (
  config?: {
    ios?: {
      entitlements?: Record<string, string[]>
    }
  },
) => {
  type: string
  name: string
  deploymentTarget: string
  bundleIdentifier: string
}

const TARGET_DIR = path.join(process.cwd(), 'targets', 'control-center')
const INTENT_FILE = path.join(TARGET_DIR, 'ControlCenterIntents.swift')
const WIDGET_FILE = path.join(TARGET_DIR, 'ControlWidget.swift')

describe('control-center target', () => {
  describe('expo-target.config.js', () => {
    it('returns correct widget configuration', () => {
      const config = controlCenterTargetConfig()

      expect(config.type).toBe('widget')
      expect(config.name).toBe('ControlCenter')
      expect(config.deploymentTarget).toBe('18.0')
      expect(config.bundleIdentifier).toBe('.ControlCenter')
    })

    it('does not inherit app-group entitlements from main app', () => {
      const config = controlCenterTargetConfig({
        ios: {
          entitlements: {
            'com.apple.security.application-groups': ['group.com.pontistudios.hakumi.preview'],
          },
        },
      })

      expect(config).toEqual({
        type: 'widget',
        name: 'ControlCenter',
        deploymentTarget: '18.0',
        bundleIdentifier: '.ControlCenter',
      })
    })
  })

  describe('ControlCenterIntents.swift', () => {
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(INTENT_FILE, 'utf-8')
    })

    it('file exists', () => {
      expect(fs.existsSync(INTENT_FILE)).toBe(true)
    })

    it('defines AddNoteControlCenterIntent', () => {
      expect(content).toContain('struct AddNoteControlCenterIntent: AppIntent')
    })

    it('defines StartChatControlCenterIntent', () => {
      expect(content).toContain('struct StartChatControlCenterIntent: AppIntent')
    })

    it('uses correct deep-link URL for Add Note', () => {
      expect(content).toContain('\\(appScheme)://note/add')
    })

    it('uses correct deep-link URL for Start Chat', () => {
      expect(content).toContain('\\(appScheme)://chat')
    })

    it('is marked available for iOS 16.0+', () => {
      expect(content).toContain('@available(iOS 16.0, *)')
    })
  })

  describe('ControlWidget.swift', () => {
    let content: string

    beforeAll(() => {
      content = fs.readFileSync(WIDGET_FILE, 'utf-8')
    })

    it('file exists', () => {
      expect(fs.existsSync(WIDGET_FILE)).toBe(true)
    })

    it('defines AddNoteControlWidget', () => {
      expect(content).toContain('struct AddNoteControlWidget: ControlWidget')
    })

    it('defines OpenChatControlWidget', () => {
      expect(content).toContain('struct OpenChatControlWidget: ControlWidget')
    })

    it('has correct widget kind identifiers', () => {
      expect(content).toContain('com.pontistudios.hakumi.control.add-note')
      expect(content).toContain('com.pontistudios.hakumi.control.open-chat')
    })

    it('references correct intent types', () => {
      expect(content).toContain('AddNoteControlCenterIntent')
      expect(content).toContain('StartChatControlCenterIntent')
    })

    it('is marked available for iOS 18.0+', () => {
      expect(content).toContain('@available(iOS 18.0, *)')
    })

    it('has accessibility labels', () => {
      expect(content).toContain('accessibilityLabel')
    })

    it('defines WidgetBundle', () => {
      expect(content).toContain('struct ControlCenterWidgetBundle: WidgetBundle')
      expect(content).toContain('@main')
    })
  })
})
