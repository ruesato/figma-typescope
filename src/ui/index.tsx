import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

/**
 * UI Entry Point
 *
 * Mounts the React application to the DOM
 */

const container = document.getElementById('root');

if (!container) {
  throw new Error('Root element not found');
}

const root = createRoot(container);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
