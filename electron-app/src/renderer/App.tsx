import React from 'react';
import { BrowserRouter } from 'react-router-dom';
import Router from './Router';
import { ToastProvider } from './contexts/ToastContext';
import { ElectronProjectProvider } from './contexts/ElectronProjectContext';
import Toast from './components/Toast/Toast';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <ToastProvider>
        <ElectronProjectProvider>
          <Router />
          <Toast />
        </ElectronProjectProvider>
      </ToastProvider>
    </BrowserRouter>
  );
};

export default App;