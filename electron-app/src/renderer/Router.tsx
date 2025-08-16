import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import ProjectsPage from './pages/ProjectsPage';
import ProjectPage from './pages/ProjectPage';
import ProductPage from './pages/ProductPage';
import ProductNew from './pages/ProductNew';

const Router: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/projects" replace />} />
        <Route path="projects" element={<ProjectsPage />} />
        <Route path="projects/:projectId" element={<ProjectPage />} />
        <Route path="projects/:projectId/products/:productId" element={<ProductPage />} />
        <Route path="projects/:projectId/products/new" element={<ProductNew />} />
      </Route>
    </Routes>
  );
};

export default Router;