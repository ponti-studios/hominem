// @jsxImportSource react
import { readAuthInit, loginInitSchema } from '../init';
import { LoginPage } from '../login-page';
import { mountApp } from '../mount';

mountApp(<LoginPage {...readAuthInit(loginInitSchema)} />);
