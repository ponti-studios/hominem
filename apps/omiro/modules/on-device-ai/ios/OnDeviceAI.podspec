Pod::Spec.new do |s|
  s.name           = 'OnDeviceAI'
  s.version        = '1.0.0'
  s.summary        = 'On-device Apple Intelligence tool-calling spike for Omiro'
  s.description    = 'Local Expo module that runs a FoundationModels session with a calendar lookup tool entirely on-device.'
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
