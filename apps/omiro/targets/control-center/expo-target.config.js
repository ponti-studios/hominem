/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = (config) => ({
  type: 'widget',
  displayName: 'Omiro Control Center',
  deploymentTarget: '15.1',
  bundleIdentifier: '.controlcenter',
});
