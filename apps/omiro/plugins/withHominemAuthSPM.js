const { withPodfile } = require('expo/config-plugins');

const INSTALLER = `
def add_hominem_auth_package(installer)
  project = installer.pods_project
  package = project.root_object.package_references.find do |reference|
    reference.isa == 'XCRemoteSwiftPackageReference' && reference.repositoryURL == 'https://github.com/charlesponti/HominemAuth.git'
  end
  unless package
    package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
    package.repositoryURL = 'https://github.com/charlesponti/HominemAuth.git'
    package.requirement = { 'kind' => 'upToNextMajorVersion', 'minimumVersion' => '0.1.0' }
    project.root_object.package_references << package
  end
  target = project.targets.find { |candidate| candidate.name == 'HominemAuthBridge' }
  raise 'Could not find HominemAuthBridge pod target' unless target
  dependency = target.package_product_dependencies.find { |candidate| candidate.product_name == 'HominemAuth' }
  unless dependency
    dependency = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    dependency.package = package
    dependency.product_name = 'HominemAuth'
    target.package_product_dependencies << dependency
  end
  unless target.frameworks_build_phase.files.any? { |build_file| build_file.product_ref == dependency }
    build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    build_file.product_ref = dependency
    target.frameworks_build_phase.files << build_file
  end
  project.save
end
`;

function withHominemAuthSPM(config) {
  return withPodfile(config, (config) => {
    let { contents } = config.modResults;
    if (contents.includes("candidate.name == 'HominemAuth'")) {
      return config;
    }
    const postInstallCall = `    react_native_post_install(\n      installer,\n      config[:reactNativePath],\n      :mac_catalyst_enabled => false,\n      :ccache_enabled => ccache_enabled?(podfile_properties),\n    )`;
    if (!contents.includes(postInstallCall)) {
      throw new Error('Could not locate the Omiro Podfile post_install hook.');
    }
    contents = contents.replace(
      postInstallCall,
      `${postInstallCall}\n    add_hominem_auth_package(installer)`,
    );
    contents = `${contents}\n${INSTALLER}`;
    config.modResults.contents = contents;
    return config;
  });
}

module.exports = withHominemAuthSPM;
