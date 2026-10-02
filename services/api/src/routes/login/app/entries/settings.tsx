// @jsxImportSource react
import { readAuthInit, settingsInitSchema } from '../init';
import { mountApp } from '../mount';
import { SettingsPage } from '../settings-page';

mountApp(<SettingsPage {...readAuthInit(settingsInitSchema)} />);
