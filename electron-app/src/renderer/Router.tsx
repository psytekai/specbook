import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout/Layout';
import ProjectsPage from './pages/ProjectsPage';
import ProjectPage from './pages/ProjectPage';
import ProductPage from './pages/ProductPage';
import ProductNew from './pages/ProductNew';
import ApiKeysPage from './pages/ApiKeysPage';

const Router: React.FC = () => {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Navigate to="/welcome" replace />} />
        <Route path="welcome" element={<ProjectsPage />} />
        <Route path="project" element={<ProjectPage />} />
        <Route path="project/products/:productId" element={<ProductPage />} />
        <Route path="project/products/new" element={<ProductNew />} />
        <Route path="apiKeys" element={<ApiKeysPage />} />
      </Route>
    </Routes>
  );
};

export default Router;