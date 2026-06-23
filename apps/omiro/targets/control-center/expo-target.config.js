/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  displayName: 'Omiro Control Center',
  deploymentTarget: '16.4',
  bundleIdentifier: '.ControlCenter',
  buildSettings: {
    CURRENT_PROJECT_VERSION: '$(inherited)',
    MARKETING_VERSION: '$(inherited)',
  },
});
