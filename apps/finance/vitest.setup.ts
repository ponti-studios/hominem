import '@testing-library/jest-dom';

process.env.NODE_ENV = 'test';
process.env.HOMINEM_INTERNAL_API_URL ??= 'http://localhost:4040';
process.env.PUBLIC_APP_URL ??= 'http://localhost:4444';
process.env.VITE_PUBLIC_API_URL ??= 'http://localhost:4040';
