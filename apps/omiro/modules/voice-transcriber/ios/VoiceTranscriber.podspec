Pod::Spec.new do |s|
  s.name           = 'VoiceTranscriber'
  s.version        = '1.0.0'
  s.summary        = 'On-device speech transcription for Hakumi'
  s.description    = 'Local Expo module that performs on-device speech transcription from recorded audio files on iOS.'
  s.author         = 'chase bridges'
  s.homepage       = 'https://github.com/hackefeller/hominem'
  s.license        = { :type => 'ISC' }
  s.platforms      = {
    :ios => '15.1'
  }
  s.source         = { :git => 'https://github.com/hackefeller/hominem.git', :tag => s.version.to_s }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
  }

  s.source_files = "**/*.{h,m,mm,swift,hpp,cpp}"
end