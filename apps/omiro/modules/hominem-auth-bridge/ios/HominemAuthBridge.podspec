Pod::Spec.new do |s|
  s.name           = 'HominemAuthBridge'
  s.module_name    = 'HominemAuthBridge'
  s.version        = '1.0.0'
  s.summary        = 'Expo bridge for HominemAuth'
  s.description    = 'Connects Omiro React Native auth flows to the HominemAuth Swift package.'
  s.author         = 'Ponti Studios'
  s.homepage       = 'https://github.com/charlesponti/HominemAuth'
  s.license        = { :type => 'MIT' }
  s.platforms      = { :ios => '15.0' }
  s.source         = { :git => 'https://github.com/charlesponti/HominemAuth.git', :tag => 'v0.2.0' }
  s.swift_version  = '6.0'
  s.static_framework = true
  s.dependency 'ExpoModulesCore'
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_INCLUDE_PATHS' => '$(inherited) $(PODS_CONFIGURATION_BUILD_DIR)',
  }
  s.source_files = '**/*.{h,m,mm,swift}'
end
