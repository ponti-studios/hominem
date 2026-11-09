import type { DoctorConfig } from 'react-doctor';

const config: DoctorConfig = {
  rules: {
    'react-doctor/effect-needs-cleanup': 'warn',
  },
  ignore: {
    rules: ['artifact-env-leak'],
  },
};

export default config;
