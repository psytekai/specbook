import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useToast } from '../hooks/useToast';
import './ProjectsPage.css';

const ProjectsPage: React.FC = () => {
  const { projects, updateProject, createProject } = useProjects();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [isCreatingProject, setIsCreatingProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');

  const handleEdit = (projectId: string, currentName: string) => {
    setEditingId(projectId);
    setEditName(currentName);
  };

  const handleSave = () => {
    if (editingId && editName.trim()) {
      updateProject(editingId, editName.trim());
      showToast('Project updated successfully', 'success');
      setEditingId(null);
      setEditName('');
    }
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditName('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
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

  return (
    <div className="page-container">
      <div className="projects-page">
        <div className="page-header">
          <h1>Projects</h1>
          <button 
            className="button button-primary"
            onClick={() => setIsCreatingProject(true)}
          >
            Add Project
          </button>
        </div>

        {isCreatingProject && (
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
        )}

        {projects.length === 0 && !isCreatingProject ? (
          <div className="empty-state">
            <p>No projects yet. Click "Add Project" to create your first project.</p>
          </div>
        ) : !isCreatingProject && projects.length > 0 ? (
          <div className="projects-table">
            <table>
              <thead>
                <tr>
                  <th>Project Name</th>
                  <th>Products</th>
                  <th>Created</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {projects.map(project => (
                  <tr key={project.id}>
                    <td>
                      {editingId === project.id ? (
                        <input
                          type="text"
                          className="input inline-edit"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={handleKeyDown}
                          onBlur={handleSave}
                          autoFocus
                        />
                      ) : (
                        <span 
                          className="project-name"
                          onClick={() => navigate(`/projects/${project.id}`)}
                        >
                          {project.name}
                        </span>
                      )}
                    </td>
                    <td>{project.productCount}</td>
                    <td>{new Date(project.createdAt).toLocaleDateString()}</td>
                    <td>{new Date(project.updatedAt).toLocaleDateString()}</td>
                    <td>
                      {editingId === project.id ? (
                        <div className="edit-actions">
                          <button 
                            className="button button-small button-primary"
                            onClick={handleSave}
                          >
                            Save
                          </button>
                          <button 
                            className="button button-small button-secondary"
                            onClick={handleCancel}
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button 
                          className="button button-small button-secondary"
                          onClick={() => handleEdit(project.id, project.name)}
                        >
                          Edit
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>
    </div>
  );
};

export default ProjectsPage;