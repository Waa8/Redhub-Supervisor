import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App-netlify';
import './styles/globals.css';

// Initialize the React application
const container = document.getElementById('root');
const root = createRoot(container);

// Render the app
root.render(<App />);

// Hot module replacement for development
if (module.hot) {
  module.hot.accept('./App-netlify', () => {
    const NextApp = require('./App-netlify').default;
    root.render(<NextApp />);
  });
}
