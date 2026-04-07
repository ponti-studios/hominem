const { withDangerousMod } = require('expo/config-plugins')
const fs = require('fs')
const path = require('path')

const BUNDLE_PATH = 'LiveActivity/LiveActivityWidgetBundle.swift'
const WIDGET_NAME = 'QuickActionsWidget'

function patchBundleFile(content) {
  if (content.includes(WIDGET_NAME)) {
    return { patched: false, reason: 'already patched' }
  }

  let hasAppIntents = content.includes('import AppIntents')
  let hasSwiftUI = content.includes('import SwiftUI')
  let hasLiveActivityWidget = content.includes('LiveActivityWidget')

  if (!hasLiveActivityWidget) {
    return { patched: false, reason: 'LiveActivityWidget not found in bundle' }
  }

  let result = content

  if (!hasAppIntents && hasSwiftUI) {
    result = result.replace(/^import SwiftUI$/m, 'import AppIntents\nimport SwiftUI')
  } else if (!hasAppIntents && !hasSwiftUI) {
    result = result.replace(/^import /m, 'import AppIntents\nimport ')
  }

  if (!result.includes(WIDGET_NAME)) {
    const widgetPattern = /(var body: some Widget \{[\s\S]*?)(    \})/
    if (widgetPattern.test(result)) {
      result = result.replace(widgetPattern, '$1\n    ' + WIDGET_NAME + '()\n$2')
    } else {
      result = result.replace(
        /(\s+LiveActivityWidget\(\))/,
        '$1\n    ' + WIDGET_NAME + '()',
      )
    }
  }

  if (result === content) {
    return { patched: false, reason: 'no matching patch pattern found' }
  }

  return { patched: true, content: result }
}

module.exports = function withWidgetBundleUpdate(config) {
  return withDangerousMod(config, [
    'ios',
    (modConfig) => {
      const bundlePath = path.join(
        modConfig.modRequest.platformProjectRoot,
        BUNDLE_PATH,
      )

      if (!fs.existsSync(bundlePath)) {
        console.warn(
          `[with-widget-bundle-update] ${BUNDLE_PATH} not found – skipping. ` +
            'This is expected if Live Activity is disabled.',
        )
        return modConfig
      }

      const original = fs.readFileSync(bundlePath, 'utf-8')
      const result = patchBundleFile(original)

      if (!result.patched) {
        if (result.reason === 'already patched') {
          return modConfig
        }
        console.warn(
          `[with-widget-bundle-update] Could not patch: ${result.reason}. Skipping.`,
        )
        return modConfig
      }

      fs.writeFileSync(bundlePath, result.content, 'utf-8')
      return modConfig
    },
  ])
}