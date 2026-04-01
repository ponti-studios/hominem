/** @type {import('detox').DetoxConfig} */

const SIMULATOR_DEVICE = process.env.DETOX_SIMULATOR_DEVICE || 'iPhone 17 Pro';
const SIMULATOR_OS = process.env.DETOX_SIMULATOR_OS || '26.2';
const SIMULATOR_UDID = process.env.DETOX_SIMULATOR_UDID;

const simulatorDestination = SIMULATOR_UDID
  ? `platform=iOS Simulator,id=${SIMULATOR_UDID}`
  : `platform=iOS Simulator,name=${SIMULATOR_DEVICE},OS=${SIMULATOR_OS}`;

module.exports = {
  testRunner: {
    args: {
      $0: 'jest',
      config: 'e2e/jest.config.cjs',
    },
    jest: {
      setupTimeout: 180000,
    },
  },
  apps: {
    'ios.e2e': {
      type: 'ios.app',
      binaryPath: 'ios/build/Build/Products/Debug-iphonesimulator/HakumiE2E.app',
      build: `cd ios && xcodebuild -project HakumiE2E.xcodeproj -scheme HakumiE2E -configuration Debug -parallelizeTargets -destination '${simulatorDestination}'`,
    },
  },
  devices: {
    simulator: {
      type: 'ios.simulator',
      device: {
        type: SIMULATOR_DEVICE,
      },
    },
  },
  configurations: {
    'ios.sim.e2e': {
      device: 'simulator',
      app: 'ios.e2e',
    },
  },
};
