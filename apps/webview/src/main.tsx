import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Acquire the VS Code API and expose it globally so components can use it
declare function acquireVsCodeApi(): any;
(window as any).vscode = acquireVsCodeApi();

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
