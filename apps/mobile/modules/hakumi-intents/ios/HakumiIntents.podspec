Pod::Spec.new do |s|
  s.name           = 'HakumiIntents'
  s.version        = '1.0.0'
  s.summary        = 'Hakumi App Intents module'
  s.description    = 'Local Expo module that exposes Hakumi App Intents and intent donation on iOS.'
  s.author         = 'chase bridges'
  s.homepage       = 'https://github.com/hackefeller/hominem'
  s.license        = { :type => 'ISC' }
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { :git => 'https://github.com/hackefeller/hominem.git', :tag => s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  # Swift/Objective-C compatibility
  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
