import { registerDefinedMcpSlice } from '../../tool-registry';
import { financeSlices } from './index';

for (const slice of financeSlices) registerDefinedMcpSlice(slice);
