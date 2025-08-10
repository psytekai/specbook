import React from 'react';
import { useNavigate } from 'react-router-dom';
import './HomePage.css';

const HomePage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="page-container">
      <div className="home-page">
        <div className="welcome-section">
          <h1>Welcome to SpecBook Manager</h1>
          <p className="subtitle">Manage your architectural product specifications with ease</p>
          
          <div className="cta-buttons">
            <button 
              className="button button-primary button-large"
              onClick={() => navigate('/projects')}
            >
              View Projects
            </button>
            <button 
              className="button button-secondary button-large"
              onClick={() => navigate('/settings')}
            >
              Settings
            </button>
          </div>
        </div>
        
        <div className="features-grid">
          <div className="feature-card">
            <h3>Organize Projects</h3>
            <p>Create and manage multiple projects to keep your specifications organized</p>
          </div>
          <div className="feature-card">
            <h3>Add Products</h3>
            <p>Easily add and track products with detailed specifications</p>
          </div>
          <div className="feature-card">
            <h3>Export Data</h3>
            <p>Export your project data in various formats for easy sharing</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HomePage;