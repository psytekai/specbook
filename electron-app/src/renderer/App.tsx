import React from 'react';
import Router from './Router';
import { ToastProvider } from './contexts/ToastContext';
import Toast from './components/Toast/Toast';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <Router />
      <Toast />
    </ToastProvider>
  );
};

export default App;