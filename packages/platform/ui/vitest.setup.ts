/// <reference types="vitest" />
import '@testing-library/jest-dom';
import {
  installBaseJsdomTestSetup,
  installRadixJsdomPolyfills,
} from '../../../config/testing/jsdom';

installBaseJsdomTestSetup();
installRadixJsdomPolyfills();
