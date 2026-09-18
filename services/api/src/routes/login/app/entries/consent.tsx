// @jsxImportSource react
import { ConsentPage } from '../consent-page';
import { readAuthInit, type ConsentInit } from '../init';
import { mountApp } from '../mount';

mountApp(<ConsentPage {...readAuthInit<ConsentInit>()} />);
