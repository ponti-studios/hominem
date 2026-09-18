// @jsxImportSource react
import { readAuthInit, type LogoutInit } from '../init';
import { LogoutPage } from '../logout-page';
import { mountApp } from '../mount';

mountApp(<LogoutPage {...readAuthInit<LogoutInit>()} />);
