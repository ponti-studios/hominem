// @jsxImportSource react
import { AuthErrorPage } from '../auth-error-page';
import { readAuthInit, errorInitSchema } from '../init';
import { mountApp } from '../mount';

mountApp(<AuthErrorPage {...readAuthInit(errorInitSchema)} />);
