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
import { FileUpload } from '../components/FileUpload';
import { LocationMultiSelect } from '../components/LocationMultiSelect';
import { CategoryMultiSelect } from '../components/CategoryMultiSelect';
import { fetchProductCategories, addProductCategory } from '../services/api';
import './ProductNew.css';

const ProductNew: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();
  const { projects, addProduct } = useProjects();
  const { showToast } = useToast();
  
  const [formData, setFormData] = useState({
    product_url: '',
    tag_id: '',
    product_location: [] as string[],
    product_image: '',
    product_images: [] as string[],
    product_description: '',
    specification_description: '',
    category: [] as string[],
    custom_image_url: '',
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDetails, setHasDetails] = useState(false);
  const [locations, setLocations] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>([]);

  const currentProject = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (!projectId || !currentProject) {
      showToast('No project selected', 'error');
      navigate('/projects');
    }
  }, [projectId, currentProject, navigate, showToast]);

  useEffect(() => {
    // Fetch available locations and categories when component mounts
    const loadData = async () => {
      try {
        const [availableLocations, availableCategories] = await Promise.all([
          fetchProductLocations(),
          fetchProductCategories()
        ]);
        setLocations(availableLocations);
        setCategories(availableCategories);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
    };
    loadData();
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

  const handleAddLocation = async (location: string) => {
    try {
      await addProductLocation(location);
      setLocations(prev => [...prev, location]);
      showToast('Location added successfully', 'success');
    } catch (_error) {
      showToast('Failed to add location', 'error');
    }
  };

  const handleAddCategory = async (category: string) => {
    try {
      await addProductCategory(category);
      setCategories(prev => [...prev, category]);
      showToast('Category added successfully', 'success');
    } catch (_error) {
      showToast('Failed to add category', 'error');
    }
  };

  const handleImageUpload = async (file: File) => {
    try {
      // For now, create a mock URL for the uploaded file
      // In a real implementation, you would upload to a server and get a URL back
      const imageUrl = URL.createObjectURL(file);
      
      setFormData(prev => ({
        ...prev,
        custom_image_url: imageUrl
      }));
      
      showToast('Image uploaded successfully', 'success');
    } catch (error) {
      showToast('Failed to upload image', 'error');
    }
  };

  const handleFetchDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { product_url, tag_id, product_location } = formData;
    
    if (!product_url || !tag_id || !product_location.length) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const details = await fetchProductDetails({
        product_url,
        tag_id,
        product_location: product_location[0] // Use first location for API call
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
        location: formData.product_location, // Already an array
        image: formData.custom_image_url || formData.product_image, // Use custom image if available
        images: formData.product_images,
        description: formData.product_description,
        specificationDescription: formData.specification_description,
        category: formData.category, // Already an array
        custom_image_url: formData.custom_image_url,
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
              <label className="label">
                Product Locations *
              </label>
              <LocationMultiSelect
                selectedLocations={formData.product_location}
                onSelectionChange={(locations: string[]) => setFormData(prev => ({ ...prev, product_location: locations }))}
                availableLocations={locations}
                onAddLocation={handleAddLocation}
                required={true}
              />
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
              
              {/* Image Upload Section */}
              <div className="form-group">
                <label className="label">Custom Product Image</label>
                <FileUpload
                  onFileSelected={handleImageUpload}
                  accept="image/*"
                  maxSize={5 * 1024 * 1024} // 5MB
                />
                <p className="form-help">Upload a custom image for this product (optional)</p>
              </div>
              
              {/* Image Preview */}
              {(formData.custom_image_url || formData.product_image) && (
                <div className="product-preview">
                  <div className="preview-header">
                    <span className="preview-label">
                      {formData.custom_image_url ? 'Custom Image' : 'Fetched Image'}
                    </span>
                    {formData.custom_image_url && (
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => setFormData(prev => ({ ...prev, custom_image_url: '' }))}
                      >
                        Remove Custom Image
                      </button>
                    )}
                  </div>
                  <img 
                    src={formData.custom_image_url || formData.product_image} 
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
                <label className="label">
                  Categories
                </label>
                <CategoryMultiSelect
                  selectedCategories={formData.category}
                  onSelectionChange={(categories) => setFormData(prev => ({ ...prev, category: categories }))}
                  availableCategories={categories}
                  onAddCategory={handleAddCategory}
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