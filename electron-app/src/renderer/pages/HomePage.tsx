import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useToast } from '../hooks/useToast';
import './HomePage.css';

const HomePage: React.FC = () => {
  const { currentProject, projects, selectProject, createProject } = useProjects();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);

  const handleAddProduct = () => {
    if (!currentProject) {
      showToast('Please select a project first', 'error');
      return;
    }
    navigate('/products/new');
  };

  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (newProjectName.trim()) {
      createProject(newProjectName.trim());
      setNewProjectName('');
      setIsCreatingProject(false);
      showToast('Project created successfully', 'success');
    }
  };

  const handleProjectSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    selectProject(e.target.value || null);
  };

  return (
    <div className="page-container">
      <div className="home-page">
        <h1>Welcome to SpecBook Manager</h1>
        
        {projects.length === 0 && !isCreatingProject ? (
          <div className="empty-state">
            <p>No projects yet. Create your first project to get started.</p>
            <button 
              className="button button-primary"
              onClick={() => setIsCreatingProject(true)}
            >
              Create First Project
            </button>
          </div>
        ) : (
          <>
            {isCreatingProject ? (
              <form onSubmit={handleCreateProject} className="create-project-form">
                <div className="form-group">
                  <label htmlFor="project-name" className="label">
                    Project Name
                  </label>
                  <input
                    id="project-name"
                    type="text"
                    className="input"
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    placeholder="Enter project name"
                    autoFocus
                  />
                </div>
                <div className="form-actions">
                  <button type="submit" className="button button-primary">
                    Create Project
                  </button>
                  <button 
                    type="button" 
                    className="button button-secondary"
                    onClick={() => {
                      setIsCreatingProject(false);
                      setNewProjectName('');
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <div className="project-selector">
                <div className="form-group">
                  <label htmlFor="project-select" className="label">
                    Select Project
                  </label>
                  <select
                    id="project-select"
                    className="input"
                    value={currentProject?.id || ''}
                    onChange={handleProjectSelect}
                  >
                    <option value="">-- Select a project --</option>
                    {projects.map(project => (
                      <option key={project.id} value={project.id}>
                        {project.name} ({project.productCount} products)
                      </option>
                    ))}
                  </select>
                </div>
                
                <div className="action-buttons">
                  <button 
                    className="button button-primary"
                    onClick={handleAddProduct}
                    disabled={!currentProject}
                  >
                    Add a Product
                  </button>
                  <button 
                    className="button button-secondary"
                    onClick={() => setIsCreatingProject(true)}
                  >
                    Create New Project
                  </button>
                </div>
              </div>
            )}
          </>
        )}
        
        {currentProject && (
          <div className="current-project-info">
            <h2>Current Project: {currentProject.name}</h2>
            <p>{currentProject.productCount} products</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default HomePage;