import React from 'react';
import Router from './Router';
import { ProjectProvider } from './contexts/ProjectContext';
import { ToastProvider } from './contexts/ToastContext';
import Toast from './components/Toast/Toast';

const App: React.FC = () => {
  return (
    <ToastProvider>
      <ProjectProvider>
        <Router />
        <Toast />
      </ProjectProvider>
    </ToastProvider>
  );
};

export default App;