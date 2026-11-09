import type { DoctorConfig } from 'react-doctor';

const config: DoctorConfig = {
  ignore: {
    rules: ['artifact-env-leak'],
  },
};

export default config;
