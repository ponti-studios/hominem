import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';

import './globals.css';

document.documentElement.dataset.theme = 'dark';
document.documentElement.style.colorScheme = 'dark';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
