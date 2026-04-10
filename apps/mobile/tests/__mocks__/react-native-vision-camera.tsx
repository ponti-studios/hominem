import React from 'react'

export const Camera = React.forwardRef(function Camera(_props, _ref) {
  return React.createElement('Camera')
})

export const useCameraDevice = () => null

export const useCameraPermission = () => ({
  hasPermission: true,
  requestPermission: async () => true,
})
