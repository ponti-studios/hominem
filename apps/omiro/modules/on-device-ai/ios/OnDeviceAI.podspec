Pod::Spec.new do |s|
  s.name           = 'OnDeviceAI'
  s.version        = '1.0.0'
  s.summary        = 'On-device EventKit access for Omiro Time'
  s.description    = 'Local Expo module that reads and edits EventKit calendars, finds open time, and matches event titles entirely on-device.'
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
