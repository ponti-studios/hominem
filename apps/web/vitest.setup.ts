import '@testing-library/jest-dom';
import { installBaseJsdomTestSetup, installDialogJsdomPolyfills } from '../../config/testing/jsdom';

installBaseJsdomTestSetup();
installDialogJsdomPolyfills();
