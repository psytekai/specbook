import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useToast } from '../hooks/useToast';
import './ProjectPage.css';

const ProjectPage: React.FC = () => {
  const { projects, updateProject } = useProjects();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');

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

  return (
    <div className="page-container">
      <div className="project-page">
        <div className="page-header">
          <h1>Projects</h1>
          <button 
            className="button button-secondary"
            onClick={() => navigate('/')}
          >
            Back to Home
          </button>
        </div>

        {projects.length === 0 ? (
          <div className="empty-state">
            <p>No projects yet. Go back to create your first project.</p>
          </div>
        ) : (
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
                          onClick={() => handleEdit(project.id, project.name)}
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
        )}
      </div>
    </div>
  );
};

export default ProjectPage;