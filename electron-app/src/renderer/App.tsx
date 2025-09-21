import React, { useEffect } from 'react';
import { HashRouter, useNavigate } from 'react-router-dom';
import Router from './Router';
import { ToastProvider } from './contexts/ToastContext';
import { ElectronProjectProvider } from './contexts/ElectronProjectContext';
import Toast from './components/Toast/Toast';

// Navigation listener component
const NavigationListener: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!window.electronAPI) return;

    // Listen for navigation events from main process
    const handleNavigate = (path: string) => {
      navigate(path);
    };

    // Add event listener for navigation
    const removeListener = window.electronAPI.onNavigate?.(handleNavigate);

    return () => {
      if (removeListener) {
        removeListener();
      }
    };
  }, [navigate]);

  return null;
};

const App: React.FC = () => {
  return (
    <HashRouter>
      <ToastProvider>
        <ElectronProjectProvider>
          <NavigationListener />
          <Router />
          <Toast />
        </ElectronProjectProvider>
      </ToastProvider>
    </HashRouter>
  );
};

export default App;