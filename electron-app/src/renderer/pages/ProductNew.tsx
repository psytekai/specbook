import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectronProject } from '../contexts/ElectronProjectContext';
import { useToast } from '../hooks/useToast';
import { 
  handleApiError,
  api
} from '../services/apiIPC';
import { LocationMultiSelect } from '../components/LocationMultiSelect';
import { CategoryMultiSelect } from '../components/CategoryMultiSelect';
import { Location, Category, AddLocationRequest, AddCategoryRequest } from '../types';
import './ProductNew.css';

const ProductNew: React.FC = () => {
  const navigate = useNavigate();
  // No projectId needed anymore since we only have one current project
  const { project, isLoading: projectLoading, isInitializing } = useElectronProject();
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
    image_hash: '',
    thumbnail_hash: '',
    images_hashes: [] as string[],
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDetails, setHasDetails] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // For the new file-based system, we only have one current project
  const currentProject = project && project.isOpen ? project : null;

  useEffect(() => {
    // Don't check during initialization or loading
    if (isInitializing || projectLoading) {
      return;
    }
    
    // Only redirect if definitively no project after initialization
    if (!currentProject) {
      console.log('❌ ProductNew: No project open, redirecting');
      showToast('No project is currently open. Please open a project first.', 'error');
      navigate('/welcome');
    }
  }, [currentProject, isInitializing, projectLoading, navigate, showToast]);

  useEffect(() => {
    // Fetch available locations and categories when component mounts
    const loadData = async () => {
      try {
        const [locationsResponse, categoriesResponse] = await Promise.all([
          api.get<Location[]>('/api/locations'),
          api.get<Category[]>('/api/categories')
        ]);
        setLocations(locationsResponse.data);
        setCategories(categoriesResponse.data);
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

  const handleAddLocation = async (locationName: string) => {
    try {
      const request: AddLocationRequest = { name: locationName };
      const response = await api.post<Location>('/api/locations', request);
      setLocations(prev => [...prev, response.data]);
      showToast('Location added successfully', 'success');
    } catch (_error) {
      showToast('Failed to add location', 'error');
    }
  };

  const handleAddCategory = async (categoryName: string) => {
    try {
      const request: AddCategoryRequest = { name: categoryName };
      const response = await api.post<Category>('/api/categories', request);
      setCategories(prev => [...prev, response.data]);
      showToast('Category added successfully', 'success');
    } catch (_error) {
      showToast('Failed to add category', 'error');
    }
  };

  const handleImageUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0);
    
    try {
      console.log('🔄 Starting image upload:', {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type
      });
      
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

      setUploadProgress(25);
      
      // Convert File to ArrayBuffer for AssetManager
      console.log('🔄 Converting file to ArrayBuffer...');
      const arrayBuffer = await file.arrayBuffer();
      console.log('🔄 ArrayBuffer created, size:', arrayBuffer.byteLength);
      
      setUploadProgress(50);
      
      // Upload via AssetManager IPC
      console.log('🔄 Calling electronAPI.assetUpload...');
      const response = await window.electronAPI.assetUpload(
        arrayBuffer, 
        file.name, 
        file.type
      );
      
      console.log('🔄 Upload response received:', response);
      setUploadProgress(75);
      
      if (response.success) {
        console.log('✅ Upload successful:', response.data);
        
        // Store asset hashes instead of data URL
        setFormData(prev => ({
          ...prev,
          image_hash: response.data.hash,
          thumbnail_hash: response.data.thumbnailHash,
          // Clear old data URL field
          custom_image_url: ''
        }));
        setUploadProgress(100);
        showToast(`Image uploaded successfully to project assets directory`, 'success');
      } else {
        console.error('❌ Upload failed:', response.error);
        throw new Error(response.error || 'Upload failed');
      }
    } catch (error) {
      console.error('❌ Image upload error:', error);
      showToast(`Failed to upload image: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    } finally {
      setTimeout(() => {
        setIsUploading(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  const handleCustomImageClick = () => {
    fileInputRef.current?.click();
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
      const response = await api.scrape({
        url: product_url,
        tag_id,
        product_location: product_location[0] // Use first location for API call
      });
      
      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch product details');
      }
      
      setFormData(prev => ({
        ...prev,
        ...response.data
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
    
    if (!formData.category || formData.category.length === 0) {
      showToast('Please select at least one category', 'error');
      return;
    }
    
    setIsSaving(true);
    
    try {
      await api.post('/api/products', {
        ...formData,
        primary_image_hash: formData.image_hash || undefined,
        primary_thumbnail_hash: formData.thumbnail_hash || undefined,
        additional_images_hashes: formData.images_hashes.length > 0 ? formData.images_hashes : undefined,
        project_id: 'current' // Use 'current' as the project ID for the new file-based system
      });
      
      showToast('Product saved successfully', 'success');
      navigate('/project');
    } catch (error) {
      const apiError = handleApiError(error);
      showToast(apiError.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Show loading state while project state is being loaded
  if (isInitializing || projectLoading) {
    return (
      <div className="page-container">
        <div className="product-new-page">
          <div className="loading-state">
            <p>{isInitializing ? 'Initializing...' : 'Loading project state...'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="product-new-page">
        <div className="page-header">
          <h1>Add New Product</h1>
          <button 
            className="button button-secondary"
            onClick={() => navigate('/project')}
          >
            Back
          </button>
        </div>
        
        <p className="current-project">Project: {currentProject?.name}</p>
        
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
              
              {/* Image Display - Shows fetched image or custom image */}
              {(formData.product_image || formData.custom_image_url || formData.thumbnail_hash) && (
                <div className="form-group">
                  <label className="label">Product Image</label>
                  <div className="product-preview">
                    <img 
                      src={
                        formData.thumbnail_hash 
                          ? `asset://${formData.thumbnail_hash}`        // Use optimized thumbnail
                          : formData.custom_image_url                   // Fallback to data URL
                          || formData.product_image                     // Fallback to scraped image
                      } 
                      alt="Product image" 
                      className="product-image"
                    />
                    <div className="image-actions">
                      {(formData.custom_image_url || formData.thumbnail_hash) ? (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={() => setFormData(prev => ({ 
                            ...prev, 
                            custom_image_url: '',
                            image_hash: '',
                            thumbnail_hash: ''
                          }))}
                        >
                          Remove Custom Image
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="button button-secondary"
                          onClick={handleCustomImageClick}
                          disabled={isUploading}
                        >
                          {isUploading ? `Uploading... ${uploadProgress}%` : 'Add Custom Image'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Remove the separate custom image preview section */}
              
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
                  Categories *
                </label>
                <CategoryMultiSelect
                  selectedCategories={formData.category}
                  onSelectionChange={(categories) => setFormData(prev => ({ ...prev, category: categories }))}
                  availableCategories={categories}
                  onAddCategory={handleAddCategory}
                  required={true}
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
        
        {/* Hidden file input for custom image upload */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) {
              handleImageUpload(file);
              // Reset the input value so the same file can be selected again
              e.target.value = '';
            }
          }}
        />
      </div>
    </div>
  );
};

export default ProductNew;