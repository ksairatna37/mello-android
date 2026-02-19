Pod::Spec.new do |s|
  s.name           = 'Audio'
  s.version        = '0.1.0'
  s.summary        = 'Native audio module for streaming capture and playback with echo cancellation'
  s.description    = 'Expo native module providing real-time audio streaming for Hume EVI integration'
  s.author         = 'Mello'
  s.homepage       = 'https://melloai.health'
  s.platforms      = { :ios => '15.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = "**/*.{h,m,mm,swift,cpp}"
end
