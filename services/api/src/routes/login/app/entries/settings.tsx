// @jsxImportSource react
import { readAuthInit, type SettingsInit } from '../init';
import { mountApp } from '../mount';
import { SettingsPage } from '../settings-page';

mountApp(<SettingsPage {...readAuthInit<SettingsInit>()} />);
