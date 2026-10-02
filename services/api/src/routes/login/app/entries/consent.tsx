// @jsxImportSource react
import { ConsentPage } from '../consent-page';
import { readAuthInit, consentInitSchema } from '../init';
import { mountApp } from '../mount';

mountApp(<ConsentPage {...readAuthInit(consentInitSchema)} />);
