// @jsxImportSource react
import { readAuthInit, logoutInitSchema } from '../init';
import { LogoutPage } from '../logout-page';
import { mountApp } from '../mount';

mountApp(<LogoutPage {...readAuthInit(logoutInitSchema)} />);
