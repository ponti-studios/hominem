// @jsxImportSource react
import { readAuthInit, type LoginInit } from '../init';
import { LoginPage } from '../login-page';
import { mountApp } from '../mount';

mountApp(<LoginPage {...readAuthInit<LoginInit>()} />);
