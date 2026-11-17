Pod::Spec.new do |s|
  s.name           = 'OmiroSystem'
  s.version        = '1.0.0'
  s.summary        = 'iOS system integrations for Omiro: Spotlight, quick actions, text recognition and PDF export'
  s.description    = 'Local Expo module that indexes content in Spotlight, routes Home Screen quick actions and Spotlight results into the app, recognizes text in images with Vision, and renders notes to PDF. Everything runs on-device.'
  s.author         = 'chase bridges'
  s.homepage       = 'https://github.com/hackefeller/hominem'
  s.license        = { :type => 'ISC' }
  s.platforms      = {
    :ios => '26.0'
  }
  s.source         = { :git => 'https://github.com/hackefeller/hominem.git', :tag => s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end
