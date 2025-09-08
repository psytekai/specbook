import React from 'react';
import { useProject } from '../../hooks/useProject';
import './NoProjectOpen.css';

interface NoProjectOpenProps {
  className?: string;
}

const NoProjectOpen: React.FC<NoProjectOpenProps> = ({ className = '' }) => {
  const { createProject, openProject, recentProjects, isLoading } = useProject();

  const handleCreateProject = async () => {
    await createProject();
  };

  const handleOpenProject = async () => {
    await openProject();
  };

  const formatRecentProjectName = (path: string): string => {
    // Extract project name from path
    const parts = path.split('/');
    const fileName = parts[parts.length - 1];
    return fileName.replace('.specbook', '');
  };

  const formatRecentProjectPath = (path: string): string => {
    // Show shortened path for display
    const parts = path.split('/');
    if (parts.length > 3) {
      return `.../${parts.slice(-2).join('/')}`;
    }
    return path;
  };

  return (
    <div className={`no-project-open ${className}`}>
      <div className="no-project-content">
        <div className="no-project-icon">
          📁
        </div>
        
        <h2>No Project Open</h2>
        <p>Create a new project or open an existing one to get started.</p>
        
        <div className="no-project-actions">
          <button
            className="button button-primary"
            onClick={handleCreateProject}
            disabled={isLoading}
          >
            {isLoading ? 'Creating...' : 'New Project'}
          </button>
          
          <button
            className="button button-secondary"
            onClick={handleOpenProject}
            disabled={isLoading}
          >
            {isLoading ? 'Opening...' : 'Open Project'}
          </button>
        </div>

        {recentProjects.length > 0 && (
          <div className="recent-projects-section">
            <h3>Recent Projects</h3>
            <div className="recent-projects-list">
              {recentProjects.slice(0, 5).map((projectPath, index) => (
                <button
                  key={index}
                  className="recent-project-item"
                  onClick={async () => {
                    // Since we can't directly open a specific recent project through the current API,
                    // we'll trigger the open dialog and let the user select from there
                    await openProject();
                  }}
                  disabled={isLoading}
                >
                  <div className="recent-project-name">
                    {formatRecentProjectName(projectPath)}
                  </div>
                  <div className="recent-project-path">
                    {formatRecentProjectPath(projectPath)}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="keyboard-shortcuts">
          <h4>Keyboard Shortcuts</h4>
          <div className="shortcut-list">
            <div className="shortcut-item">
              <kbd>Cmd+N</kbd>
              <span>New Project</span>
            </div>
            <div className="shortcut-item">
              <kbd>Cmd+O</kbd>
              <span>Open Project</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NoProjectOpen;