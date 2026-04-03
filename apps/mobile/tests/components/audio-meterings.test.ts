import React from 'react'
import { render } from '@testing-library/react-native'

jest.mock('react-native-reanimated')

import { AudioLevelVisualizer } from '../../components/media/audio-meterings'
import {
  buildAudioBarModels,
  normalizeDb,
} from '../../components/media/audio-meterings-model'

describe('audio metering helpers', () => {
  it('clamps and normalizes decibel values into visual heights', () => {
    expect(normalizeDb(-100)).toBe(7)
    expect(normalizeDb(10)).toBe(50)
    expect(normalizeDb(-25)).toBeGreaterThan(7)
    expect(normalizeDb(-25)).toBeLessThan(50)
  })

  it('builds stable bar models with deterministic keys and positions', () => {
    expect(buildAudioBarModels([-50, -25, 0])).toEqual([
      { key: 'bar-0', x: 0, targetHeight: 7 },
      { key: 'bar-8', x: 8, targetHeight: 28.5 },
      { key: 'bar-16', x: 16, targetHeight: 50 },
    ])
  })

  it('renders one animated bar per metering level', () => {
    const screen = render(React.createElement(AudioLevelVisualizer, { levels: [-50, -25, 0] }))

    expect(screen.getByTestId('audio-meter')).toBeTruthy()
    expect(screen.getAllByTestId('audio-meter-bar')).toHaveLength(3)
  })
})
