import type { HakumiIntentsModuleType } from './HakumiIntentsModule';

const HakumiIntentsModule: HakumiIntentsModuleType = {
  async donate() {
    return false;
  },
};

export default HakumiIntentsModule;
