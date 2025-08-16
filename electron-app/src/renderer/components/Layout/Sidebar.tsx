import React from 'react';
import { NavLink } from 'react-router-dom';
import './Sidebar.css';

const Sidebar: React.FC = () => {
  return (
    <nav className="sidebar">
      <div className="sidebar-header">
        <h2>SpecBook</h2>
      </div>
      <ul className="sidebar-nav">
        <li>
          <NavLink to="/projects" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
            <svg className="sidebar-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
            <span>Projects</span>
          </NavLink>
        </li>
      </ul>
    </nav>
  );
};

export default Sidebar;