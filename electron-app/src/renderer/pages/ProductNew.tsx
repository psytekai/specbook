import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { useToast } from '../hooks/useToast';
import { 
  fetchProductDetails, 
  saveProduct, 
  handleApiError,
  fetchProductLocations,
  addProductLocation 
} from '../services/api';
import './ProductNew.css';

const ProductNew: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, addProduct } = useProjects();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    product_url: '',
    tag_id: '',
    product_location: '',
    product_image: '',
    product_images: [] as string[],
    product_description: '',
    specification_description: '',
    category: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDetails, setHasDetails] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState('');

  const currentProject = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (!projectId || !currentProject) {
      showToast('No project selected', 'error');
      navigate('/projects');
    }
  }, [projectId, currentProject, navigate, showToast]);

  useEffect(() => {
    // Fetch available locations when component mounts
    const loadLocations = async () => {
      try {
        const availableLocations = await fetchProductLocations();
        setLocations(availableLocations);
      } catch (error) {
        console.error('Failed to fetch locations:', error);
      }
    };
    loadLocations();
  }, []);

  if (!currentProject) {
    return null;
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleAddLocation = async () => {
    if (!newLocation.trim()) {
      showToast('Please enter a location name', 'error');
      return;
    }

    try {
      await addProductLocation(newLocation.trim());
      setLocations(prev => [...prev, newLocation.trim()]);
      setFormData(prev => ({ ...prev, product_location: newLocation.trim() }));
      setNewLocation('');
      setShowAddLocation(false);
      showToast('Location added successfully', 'success');
    } catch (error) {
      showToast('Failed to add location', 'error');
    }
  };

  const handleFetchDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { product_url, tag_id, product_location } = formData;
    
    if (!product_url || !tag_id || !product_location) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const details = await fetchProductDetails({
        product_url,
        tag_id,
        product_location
      });
      
      setFormData(prev => ({
        ...prev,
        ...details
      }));
      
      setHasDetails(true);
      showToast('Product details fetched successfully', 'success');
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!hasDetails) {
      showToast('Please fetch product details first', 'error');
      return;
    }
    
    setIsSaving(true);
    
    try {
      await saveProduct({
        ...formData,
        project_id: currentProject.id
      });
      
      // Add to local state
      addProduct({
        projectId: currentProject.id,
        url: formData.product_url,
        tagId: formData.tag_id,
        location: formData.product_location,
        image: formData.product_image,
        images: formData.product_images,
        description: formData.product_description,
        specificationDescription: formData.specification_description,
        category: formData.category,
      });
      
      showToast('Product saved successfully', 'success');
      navigate(`/projects/${projectId}`);
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="product-new-page">
        <div className="page-header">
          <h1>Add New Product</h1>
          <button 
            className="button button-secondary"
            onClick={() => navigate(`/projects/${projectId}`)}
          >
            Back
          </button>
        </div>
        
        <p className="current-project">Project: {currentProject.name}</p>
        
        <form onSubmit={handleFetchDetails} className="product-form">
          <div className="form-section">
            <h2>Product Information</h2>
            
            <div className="form-group">
              <label htmlFor="product_url" className="label">
                Product URL *
              </label>
              <input
                id="product_url"
                name="product_url"
                type="url"
                className="input"
                value={formData.product_url}
                onChange={handleInputChange}
                placeholder="https://example.com/product"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="tag_id" className="label">
                Tag ID *
              </label>
              <input
                id="tag_id"
                name="tag_id"
                type="text"
                className="input"
                value={formData.tag_id}
                onChange={handleInputChange}
                placeholder="Enter tag ID"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="product_location" className="label">
                Product Location *
              </label>
              {!showAddLocation ? (
                <div className="location-dropdown-wrapper">
                  <select
                    id="product_location"
                    name="product_location"
                    className="input"
                    value={formData.product_location}
                    onChange={handleInputChange}
                    required
                  >
                    <option value="">-- Select a location --</option>
                    {locations.map(location => (
                      <option key={location} value={location}>
                        {location}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="button button-secondary button-small"
                    onClick={() => setShowAddLocation(true)}
                  >
                    Add New
                  </button>
                </div>
              ) : (
                <div className="add-location-wrapper">
                  <input
                    type="text"
                    className="input"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="Enter new location"
                    autoFocus
                  />
                  <div className="add-location-actions">
                    <button
                      type="button"
                      className="button button-primary button-small"
                      onClick={handleAddLocation}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      className="button button-secondary button-small"
                      onClick={() => {
                        setShowAddLocation(false);
                        setNewLocation('');
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              className="button button-primary"
              disabled={isLoading}
            >
              {isLoading ? 'Fetching...' : 'Fetch Product Details'}
            </button>
          </div>
          
          {hasDetails && (
            <div className="form-section">
              <h2>Product Details</h2>
              
              {formData.product_image && (
                <div className="product-preview">
                  <img 
                    src={formData.product_image} 
                    alt="Product preview" 
                    className="product-image"
                  />
                </div>
              )}
              
              <div className="form-group">
                <label htmlFor="product_description" className="label">
                  Description
                </label>
                <textarea
                  id="product_description"
                  name="product_description"
                  className="input textarea"
                  value={formData.product_description}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="specification_description" className="label">
                  Specifications
                </label>
                <textarea
                  id="specification_description"
                  name="specification_description"
                  className="input textarea"
                  value={formData.specification_description}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="category" className="label">
                  Category
                </label>
                <input
                  id="category"
                  name="category"
                  type="text"
                  className="input"
                  value={formData.category}
                  onChange={handleInputChange}
                />
              </div>
              
              <button 
                type="button"
                className="button button-primary"
                onClick={handleSaveProduct}
                disabled={isSaving}
              >
                {isSaving ? 'Saving...' : 'Add Product'}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default ProductNew;