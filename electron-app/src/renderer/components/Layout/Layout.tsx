import React from 'react';
import { Outlet } from 'react-router-dom';
import './Layout.css';

const Layout: React.FC = () => {
  return (
    <div className="layout">
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;