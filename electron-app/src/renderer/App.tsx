import React from 'react';
import { HashRouter } from 'react-router-dom';
import Router from './Router';
import { ToastProvider } from './contexts/ToastContext';
import { ElectronProjectProvider } from './contexts/ElectronProjectContext';
import Toast from './components/Toast/Toast';

const App: React.FC = () => {
  return (
    <HashRouter>
      <ToastProvider>
        <ElectronProjectProvider>
          <Router />
          <Toast />
        </ElectronProjectProvider>
      </ToastProvider>
    </HashRouter>
  );
};

export default App;