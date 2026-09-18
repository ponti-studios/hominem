// @jsxImportSource react
import { AuthErrorPage } from '../auth-error-page';
import { readAuthInit, type ErrorInit } from '../init';
import { mountApp } from '../mount';

mountApp(<AuthErrorPage {...readAuthInit<ErrorInit>()} />);
