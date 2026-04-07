const { IOSConfig, withPodfile, withXcodeProject } = require('expo/config-plugins');

const DEFAULT_SWIFT_VERSION = '5.9';
const SWIFT_STRICT_CONCURRENCY = 'minimal';

function withAppTargetSwiftSettings(config) {
  return withXcodeProject(config, (modConfig) => {
    const project = modConfig.modResults;
    const nativeTargets = IOSConfig.Target.getNativeTargets(project);

    for (const [, target] of nativeTargets) {
      if (!IOSConfig.Target.isTargetOfType(target, IOSConfig.Target.TargetType.APPLICATION)) {
        continue;
      }

      const buildConfigurationListId = target.buildConfigurationList;
      for (const [, buildConfigurations] of IOSConfig.XcodeUtils.getBuildConfigurationsForListId(
        project,
        buildConfigurationListId,
      )) {
        buildConfigurations.buildSettings ??= {};
        buildConfigurations.buildSettings.SWIFT_VERSION = DEFAULT_SWIFT_VERSION;
        buildConfigurations.buildSettings.SWIFT_STRICT_CONCURRENCY = SWIFT_STRICT_CONCURRENCY;
      }
    }

    return modConfig;
  });
}

function withPodfileSwiftSettings(config) {
  return withPodfile(config, (modConfig) => {
    const originalContents = modConfig.modResults.contents;
    const postInstallPattern =
      /post_install do \|installer\|\n([\s\S]*?react_native_post_install\([\s\S]*?\n\s+\)\n)(\s*end\n)/m;
    const injectedBlock = [
      '    installer.pods_project.targets.each do |target|',
      '      swift_version = begin',
      '        podspec_path = File.join(__dir__, "Pods", "Local Podspecs", "#{target.name}.podspec.json")',
      '        if File.exist?(podspec_path)',
      '          podspec = JSON.parse(File.read(podspec_path))',
      '          swift_versions = podspec["swift_versions"] || podspec["swift_version"]',
      '          Array(swift_versions).compact.first || "' + DEFAULT_SWIFT_VERSION + '"',
      '        else',
      '          "' + DEFAULT_SWIFT_VERSION + '"',
      '        end',
      '      rescue StandardError',
      '        "' + DEFAULT_SWIFT_VERSION + '"',
      '      end',
      '',
      '      target.build_configurations.each do |build_configuration|',
      '        build_configuration.build_settings["SWIFT_VERSION"] = swift_version',
      '        build_configuration.build_settings["SWIFT_STRICT_CONCURRENCY"] = "' +
        SWIFT_STRICT_CONCURRENCY +
        '"',
      '      end',
      '    end',
      '',
    ].join('\n');

    if (originalContents.includes('installer.pods_project.targets.each do |target|')) {
      return modConfig;
    }

    if (!postInstallPattern.test(originalContents)) {
      throw new Error(
        '[with-swift-compat] Could not find the post_install block in Podfile. ' +
          'The generated Podfile format likely changed.',
      );
    }

    modConfig.modResults.contents = originalContents.replace(
      postInstallPattern,
      (match, reactNativePostInstall, endBlock) =>
        `post_install do |installer|\n${reactNativePostInstall}${injectedBlock}${endBlock}`,
    );

    return modConfig;
  });
}

module.exports = function withSwiftCompat(config) {
  config = withAppTargetSwiftSettings(config);
  config = withPodfileSwiftSettings(config);
  return config;
};
