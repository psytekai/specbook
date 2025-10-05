import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectronProject } from '../contexts/ElectronProjectContext';
import { useToast } from '../hooks/useToast';
import { getAssetUrl, getPlaceholderImage } from '../../shared/utils/assetUtils';
import './ProjectInfoPage.css';

const ProjectInfoPage: React.FC = () => {
  const navigate = useNavigate();
  const { project, isLoading, isInitializing, saveProject } = useElectronProject();
  const { showToast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    subtitle: '',
    addressLine1: '',
    addressLine2: '',
    createdByName: '',
    createdByEmail: '',
    projectPhotoHash: '',
    companyLogoHash: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const projectPhotoInputRef = useRef<HTMLInputElement>(null);
  const companyLogoInputRef = useRef<HTMLInputElement>(null);

  // Initialize form data when project loads (only once on mount or when project path changes)
  const projectPathRef = useRef<string | undefined>();

  useEffect(() => {
    if (project && project.path !== projectPathRef.current) {
      projectPathRef.current = project.path;
      setFormData({
        name: project.name || '',
        subtitle: project.subtitle || '',
        addressLine1: project.addressLine1 || '',
        addressLine2: project.addressLine2 || '',
        createdByName: project.createdByName || '',
        createdByEmail: project.createdByEmail || '',
        projectPhotoHash: project.projectPhotoHash || '',
        companyLogoHash: project.companyLogoHash || ''
      });
    }
  }, [project]);

  // Don't redirect during initialization
  if (isInitializing) {
    return (
      <div className="page-container">
        <div className="project-info-page">
          <div className="loading-state">
            <p>Initializing...</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to welcome page if no project is open
  useEffect(() => {
    if (!isLoading && !project) {
      navigate('/welcome');
    }
  }, [project, isLoading, navigate]);

  // Show loading state while checking for project
  if (isLoading || !project) {
    return (
      <div className="page-container">
        <div className="project-info-page">
          <div className="loading-state">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  // Function to handle image uploads
  const handleImageUpload = async (file: File, field: 'projectPhotoHash' | 'companyLogoHash') => {
    if (!project) return;

    try {
      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        showToast('Image file size must be less than 5MB', 'error');
        return;
      }

      // Validate file type (must be an image)
      if (!file.type.startsWith('image/')) {
        showToast('Please select a valid image file', 'error');
        return;
      }

      console.log('Starting asset upload for file:', file.name);

      // Convert file to ArrayBuffer for asset manager
      const arrayBuffer = await file.arrayBuffer();

      // Upload to asset manager
      const result = await window.electronAPI.assetUpload(arrayBuffer, file.name, file.type, {
        generateThumbnail: true,
        quality: 85,
        thumbnailSize: { width: 400, height: 400 }
      });

      if (result.success && result.data) {
        console.log('Asset uploaded successfully:', result.data);

        // Update form data with new asset hash
        setFormData(prev => ({
          ...prev,
          [field]: result.data.hash
        }));

        showToast('Image uploaded successfully', 'success');
      } else {
        console.error('Asset upload failed:', result.error);
        showToast('Failed to upload image', 'error');
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      showToast('Failed to upload image', 'error');
    }
  };

  const handleProjectPhotoClick = () => {
    projectPhotoInputRef.current?.click();
  };

  const handleCompanyLogoClick = () => {
    companyLogoInputRef.current?.click();
  };

  const handleRemoveImage = (field: 'projectPhotoHash' | 'companyLogoHash') => {
    const imageName = field === 'projectPhotoHash' ? 'project photo' : 'company logo';

    if (window.confirm(`Are you sure you want to remove the ${imageName}?`)) {
      setFormData(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      showToast('Project title is required', 'error');
      return;
    }

    try {
      setIsSaving(true);

      // Save all fields to project
      await saveProject({
        name: formData.name,
        subtitle: formData.subtitle || undefined,
        addressLine1: formData.addressLine1 || undefined,
        addressLine2: formData.addressLine2 || undefined,
        createdByName: formData.createdByName || undefined,
        createdByEmail: formData.createdByEmail || undefined,
        projectPhotoHash: formData.projectPhotoHash || undefined,
        companyLogoHash: formData.companyLogoHash || undefined
      });

      showToast('Project information saved successfully', 'success');
    } catch (err) {
      console.error('Failed to save project info:', err);
      showToast('Failed to save project information', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="project-info-page">
        <div className="page-header">
          <h1>Project Information</h1>
          <p className="page-description">
            Configure cover page details for your specification book
          </p>
          <button
            className="button button-secondary"
            onClick={() => navigate('/project')}
          >
            Home
          </button>
        </div>

        <form onSubmit={handleSave} className="project-info-form">
          <div className="form-section">
            <h2>Project Details</h2>

            <div className="form-group">
              <label htmlFor="name" className="label">
                Project Title *
              </label>
              <input
                id="name"
                name="name"
                type="text"
                className="input"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter project title"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="subtitle" className="label">
                Project Subtitle
              </label>
              <input
                id="subtitle"
                name="subtitle"
                type="text"
                className="input"
                value={formData.subtitle}
                onChange={handleInputChange}
                placeholder="Enter project subtitle"
              />
            </div>

            <div className="form-group">
              <label htmlFor="addressLine1" className="label">
                Address Line 1
              </label>
              <input
                id="addressLine1"
                name="addressLine1"
                type="text"
                className="input"
                value={formData.addressLine1}
                onChange={handleInputChange}
                placeholder="Enter address line 1"
              />
            </div>

            <div className="form-group">
              <label htmlFor="addressLine2" className="label">
                Address Line 2
              </label>
              <input
                id="addressLine2"
                name="addressLine2"
                type="text"
                className="input"
                value={formData.addressLine2}
                onChange={handleInputChange}
                placeholder="Enter address line 2"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Created By</h2>

            <div className="form-group">
              <label htmlFor="createdByName" className="label">
                Name
              </label>
              <input
                id="createdByName"
                name="createdByName"
                type="text"
                className="input"
                value={formData.createdByName}
                onChange={handleInputChange}
                placeholder="Enter name"
              />
            </div>

            <div className="form-group">
              <label htmlFor="createdByEmail" className="label">
                Email
              </label>
              <input
                id="createdByEmail"
                name="createdByEmail"
                type="email"
                className="input"
                value={formData.createdByEmail}
                onChange={handleInputChange}
                placeholder="Enter email"
              />
            </div>
          </div>

          <div className="form-section">
            <h2>Images</h2>

            <div className="image-upload-group">
              <div className="image-upload-item">
                <h3>Project Photo</h3>
                <div className="image-preview">
                  {formData.projectPhotoHash ? (
                    <div className="image-container">
                      <img
                        src={getAssetUrl(formData.projectPhotoHash)}
                        alt="Project photo"
                      />
                      <button
                        type="button"
                        className="image-delete-btn"
                        onClick={() => handleRemoveImage('projectPhotoHash')}
                        aria-label="Remove project photo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="image-container">
                      <img
                        src={getPlaceholderImage()}
                        alt="No project photo"
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleProjectPhotoClick}
                  disabled={isSaving}
                >
                  Upload Project Photo
                </button>
              </div>

              <div className="image-upload-item">
                <h3>Company Logo</h3>
                <div className="image-preview">
                  {formData.companyLogoHash ? (
                    <div className="image-container">
                      <img
                        src={getAssetUrl(formData.companyLogoHash)}
                        alt="Company logo"
                      />
                      <button
                        type="button"
                        className="image-delete-btn"
                        onClick={() => handleRemoveImage('companyLogoHash')}
                        aria-label="Remove company logo"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div className="image-container">
                      <img
                        src={getPlaceholderImage()}
                        alt="No company logo"
                      />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleCompanyLogoClick}
                  disabled={isSaving}
                >
                  Upload Company Logo
                </button>
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button button-secondary"
              onClick={() => navigate('/project')}
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Project Information'}
            </button>
          </div>
        </form>

        {/* Hidden file inputs for image uploads */}
        <input
          ref={projectPhotoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file, 'projectPhotoHash');
              e.target.value = '';
            }
          }}
        />

        <input
          ref={companyLogoInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file, 'companyLogoHash');
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
};

export default ProjectInfoPage;
