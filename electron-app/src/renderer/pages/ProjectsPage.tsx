import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectronProject } from '../contexts/ElectronProjectContext';
import { NoProjectOpen } from '../components/NoProjectOpen';
import { useToast } from '../hooks/useToast';
import './ProjectsPage.css';

const ProjectsPage: React.FC = () => {
  const navigate = useNavigate();
  const { project, isLoading, isInitializing, error, closeProject } = useElectronProject();
  const { showToast } = useToast();

  // Show error toast if there's an error
  React.useEffect(() => {
    if (error) {
      showToast(error, 'error');
    }
  }, [error, showToast]);

  // Show loading state
  if (isInitializing || isLoading) {
    return (
      <div className="page-container">
        <div className="projects-page">
          <div className="loading-state">
            <p>{isInitializing ? 'Initializing...' : 'Loading project...'}</p>
          </div>
        </div>
      </div>
    );
  }

  // Show NoProjectOpen component when no project is open
  if (!project || !project.isOpen) {
    return (
      <div className="page-container">
        <div className="projects-page">
          <NoProjectOpen />
        </div>
      </div>
    );
  }

  // Show current project info when a project is open
  return (
    <div className="page-container">
      <div className="projects-page">
        <div className="page-header">
          <h1>Current Project</h1>
          <div className="project-actions">
            <button 
              className="button button-secondary"
              onClick={async () => {
                // This will be handled by the File menu, but we can also trigger it here
                if (window.electronAPI) {
                  await window.electronAPI.triggerNewProject();
                }
              }}
            >
              New Project
            </button>
            <button 
              className="button button-secondary"
              onClick={async () => {
                // This will be handled by the File menu, but we can also trigger it here
                if (window.electronAPI) {
                  await window.electronAPI.triggerOpenProject();
                }
              }}
            >
              Open Project
            </button>
          </div>
        </div>

        <div className="current-project-info">
          <div className="project-card">
            <h2>{project.name || 'Untitled Project'}</h2>
            <div className="project-details">
              <p><strong>Status:</strong> {project.isDirty ? 'Modified' : 'Saved'}</p>
              <p><strong>Path:</strong> {project.path || 'Unknown'}</p>
              {project.createdAt && (
                <p><strong>Created:</strong> {new Date(project.createdAt).toLocaleDateString()}</p>
              )}
              {project.updatedAt && (
                <p><strong>Updated:</strong> {new Date(project.updatedAt).toLocaleDateString()}</p>
              )}
            </div>
            <div className="project-actions">
              <button 
                className="button button-primary"
                onClick={() => navigate('/project')}
              >
                View Products
              </button>
              <button 
                className="button button-secondary"
                onClick={async () => {
                  if (window.electronAPI) {
                    const result = await window.electronAPI.saveProject();
                    if (result.success) {
                      showToast('Project saved successfully', 'success');
                    } else {
                      showToast(result.error || 'Failed to save project', 'error');
                    }
                  }
                }}
                disabled={!project.isDirty}
              >
                Save Project
              </button>
              <button 
                className="button button-danger"
                onClick={async () => {
                  const result = await closeProject();
                  if (result) {
                    showToast('Project closed successfully', 'success');
                  } else {
                    showToast('Failed to close project', 'error');
                  }
                }}
                disabled={isLoading}
              >
                {isLoading ? 'Closing...' : 'Close Project'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProjectsPage;