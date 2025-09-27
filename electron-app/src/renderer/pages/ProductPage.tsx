import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useElectronProject } from '../contexts/ElectronProjectContext';
import { Product } from '../../shared/types';
import { api } from '../services/apiIPC';
import { Location, Category, AddLocationRequest, AddCategoryRequest } from '../types';
import { EditableSection } from '../components/EditableSection';
import { CategoryMultiSelect } from '../components/CategoryMultiSelect';
import { LocationMultiSelect } from '../components/LocationMultiSelect';
import { formatPrice } from '../utils/formatters';
import { getProductImageUrl, getPlaceholderImage } from '../../shared/utils/assetUtils';
import './ProductPage.css';

const ProductPage: React.FC = () => {
  const { productId } = useParams<{ productId: string }>();
  const navigate = useNavigate();
  const { project, isLoading: projectLoading, isInitializing } = useElectronProject();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Add handlers for multi-select components
  const handleAddLocation = async (locationName: string): Promise<Location> => {
    try {
      const request: AddLocationRequest = { name: locationName };
      const response = await api.post<Location>('/api/locations', request);
      setLocations(prev => [...prev, response.data]);
      return response.data;
    } catch (error) {
      throw new Error('Failed to add location');
    }
  };

  const handleAddCategory = async (categoryName: string): Promise<Category> => {
    try {
      const request: AddCategoryRequest = { name: categoryName };
      const response = await api.post<Category>('/api/categories', request);
      setCategories(prev => [...prev, response.data]);
      return response.data;
    } catch (error) {
      throw new Error('Failed to add category');
    }
  };

  // For the new file-based system, we only have one current project
  // Check if we have a project open (regardless of productId from URL)

  // Don't redirect during initialization
  if (isInitializing) {
    return (
      <div className="page-container">
        <div className="product-page">
          <div className="loading-state">
            <p>Initializing...</p>
          </div>
        </div>
      </div>
    );
  }

  // Redirect to welcome page if no project is open
  useEffect(() => {
    if (!projectLoading && !project) {
      navigate('/welcome');
    }
  }, [project, projectLoading, navigate]);

  useEffect(() => {
    if (!productId) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        // First get all products for the current project, then find the specific one
        const response = await api.get<Product[]>(`/api/projects/current/products`);
        const foundProduct = response.data.find(p => p.id === productId);
        
        if (!foundProduct) {
          setError('Product not found');
        } else {
          console.log('Product loaded:', foundProduct);
          setProduct(foundProduct);
        }
      } catch (err) {
        setError('Failed to load product');
        console.error('Error fetching product:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProduct();
  }, [productId]);

  // Load categories and locations for dropdowns
  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [categoriesResponse, locationsResponse] = await Promise.all([
          api.get<Category[]>('/api/categories'),
          api.get<Location[]>('/api/locations')
        ]);
        setCategories(categoriesResponse.data);
        setLocations(locationsResponse.data);
      } catch (err) {
        console.error('Failed to load options:', err);
      }
    };

    loadOptions();
  }, []);

  // Function to update a single product field
  const updateProductField = async (field: keyof Product, value: string | number | string[] | null | undefined) => {
    if (!product) return;

    try {
      // Update the product via API
      const response = await api.put<Product>(`/api/products/${product.id}`, { [field]: value });
      
      if (response.success && response.data) {
        // Update local state with the response from backend
        setProduct(response.data);
        console.log(`Updated ${field} to:`, value);
      } else {
        throw new Error(response.error || 'Failed to update product');
      }
    } catch (err) {
      console.error(`Failed to update ${field}:`, err);
      throw new Error(`Failed to update product field: (${err})`);
    }
  };;

  // Function to handle image uploads using AssetManager
  const handleImageUpload = async (file: File) => {
    if (!product) return;

    try {
      // Validate file size (5MB limit)
      const maxSize = 5 * 1024 * 1024; // 5MB
      if (file.size > maxSize) {
        console.error('Image file size must be less than 5MB');
        return;
      }

      // Validate file type (must be an image)
      if (!file.type.startsWith('image/')) {
        console.error('Please select a valid image file');
        return;
      }

      console.log('Starting asset upload for file:', file.name);

      // Convert file to ArrayBuffer for asset manager
      const arrayBuffer = await file.arrayBuffer();
      
      // Upload to asset manager
      const result = await window.electronAPI.assetUpload(arrayBuffer, file.name, file.type, {
        generateThumbnail: true,
        quality: 85,
        thumbnailSize: { width: 200, height: 200 }
      });

      if (result.success && result.data) {
        console.log('Asset uploaded successfully:', result.data);
        
        // Update product with new asset hashes
        await updateProductField('primaryImageHash', result.data.hash);
        await updateProductField('primaryThumbnailHash', result.data.thumbnailHash);
        
        console.log('Product updated with asset hashes');
      } else {
        console.error('Asset upload failed:', result.error);
      }
    } catch (err) {
      console.error('Failed to upload image:', err);
      throw new Error('Failed to upload image');
    }
  };

  const handleCustomImageClick = () => {
    fileInputRef.current?.click();
  };


  // Show loading state while checking for project
  if (projectLoading || !project) {
    return (
      <div className="page-container">
        <div className="product-page">
          <div className="loading-state">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="page-container">
        <div className="product-page">
          <div className="loading-state">
            <p>Loading product...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-container">
        <div className="product-page">
          <div className="error-state">
            <p>{error || 'Product not found'}</p>
            <button 
              className="button button-secondary"
              onClick={() => navigate('/project')}
            >
              Back to Project
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="product-page">
        <div className="page-header">
          <div>
            <h1>[{product.tagId}] {product.productName || product.type || "Untitled Product"}</h1>
            <p className="project-breadcrumb">
              <span 
                className="breadcrumb-link"
                onClick={() => navigate('/project')}
              >
                {project.name}
              </span>
              {' > '}
              <span>{product.productName}</span>
            </p>
          </div>
          <button 
            className="button button-secondary"
            onClick={() => navigate('/project')}
          >
            Back to Project
          </button>
        </div>

        <div className="product-content">
          <div className="product-images">
            {/* Main Image Section */}
            <div className="main-image-section">
              <h3>Product Image</h3>
              
              {/* Current Image Display */}
              {getProductImageUrl(product) ? (
                <div className="main-image">
                  <div className="image-container">
                    <img 
                      src={getProductImageUrl(product)!} 
                      alt={product.type || 'Product image'}
                    />
                    <button
                      type="button"
                      className="image-delete-btn"
                      onClick={() => {
                        updateProductField('primaryImageHash', null);
                        updateProductField('primaryThumbnailHash', null);
                      }}
                      aria-label="Remove image"
                    >
✕
                    </button>
                  </div>
                </div>
              ) : (
                <div className="main-image">
                  <div className="image-container">
                    <img 
                      src={getPlaceholderImage()} 
                      alt="No image available"
                    />
                  </div>
                </div>
              )}
              
              {/* Image Upload Section */}
              <div className="image-upload-section">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleCustomImageClick}
                >
                  Upload Image
                </button>
                <p className="upload-help">Upload an image for this product (max 5MB)</p>
              </div>
            </div>
            
          </div>

          <div className="product-details">
            <div className="detail-section">
              <h2>Product Information</h2>
              <div className="editable-details">
                <EditableSection
                  label="Product Name"
                  value={product.productName}
                  type="text"
                  placeholder="Enter product name"
                  onSave={(value) => updateProductField('productName', value as string)}
                />
                
                <EditableSection
                  label="Manufacturer"
                  value={product.manufacturer}
                  type="text"
                  placeholder="Enter manufacturer"
                  onSave={(value) => updateProductField('manufacturer', value as string)}
                />
                
                <EditableSection
                  label="Price"
                  value={product.price}
                  type="number"
                  placeholder="0.00"
                  formatDisplay={(value) => value ? formatPrice(value as number) : 'Not specified'}
                  onSave={(value) => updateProductField('price', value as number)}
                />
                
                <div className="editable-field">
                  <label className="editable-label">Categories</label>
                  <CategoryMultiSelect
                    selectedCategories={Array.isArray(product.category) ? product.category : [product.category].filter(Boolean)}
                    onSelectionChange={(categoryIds) => updateProductField('category', categoryIds)}
                    availableCategories={categories}
                    onAddCategory={handleAddCategory}
                  />
                </div>
                
                <div className="editable-field">
                  <label className="editable-label">Locations</label>
                  <LocationMultiSelect
                    selectedLocations={Array.isArray(product.location) ? product.location : [product.location].filter(Boolean)}
                    onSelectionChange={(locationIds: string[]) => updateProductField('location', locationIds)}
                    availableLocations={locations}
                    onAddLocation={handleAddLocation}
                  />
                </div>

                <EditableSection
                  label="Tag ID"
                  value={product.tagId}
                  type="text"
                  placeholder="Enter tag ID"
                  onSave={(value) => updateProductField('tagId', value as string)}
                />
                
                <div className="detail-item static">
                  <label>Added:</label>
                  <span>{new Date(product.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h2>Description</h2>
              <EditableSection
                label="Product Type"
                value={product.type}
                type="textarea"
                placeholder="Enter product type"
                multiline={true}
                onSave={(value) => updateProductField('type', value as string)}
                className="full-width"
              />
            </div>

            <div className="detail-section">
              <h2>Specifications</h2>
              <EditableSection
                label="Specification Details"
                value={product.specificationDescription}
                type="textarea"
                placeholder="Enter specification details"
                multiline={true}
                onSave={(value) => updateProductField('specificationDescription', value as string)}
                className="full-width"
              />
            </div>

            <div className="detail-section">
              <h2>Source</h2>
              <a 
                href={product.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="source-link"
              >
                View Original Product Page →
              </a>
            </div>
          </div>
        </div>
      </div>
      
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
  );
};

export default ProductPage;