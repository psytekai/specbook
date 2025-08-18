import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { Product } from '../types';
import { api } from '../services/api';
import { Location, Category, AddLocationRequest, AddCategoryRequest } from '../types';
import { EditableSection } from '../components/EditableSection';
import { FileUpload } from '../components/FileUpload';
import { CategoryMultiSelect } from '../components/CategoryMultiSelect';
import { LocationMultiSelect } from '../components/LocationMultiSelect';
import { formatPrice } from '../utils/formatters';
import './ProductPage.css';

const ProductPage: React.FC = () => {
  const { projectId, productId } = useParams<{ projectId: string; productId: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  
  // Add handlers for multi-select components
  const handleAddLocation = async (locationName: string) => {
    try {
      const request: AddLocationRequest = { name: locationName };
      const response = await api.post<Location>('/api/locations', request);
      setLocations(prev => [...prev, response.data]);
    } catch (error) {
      throw new Error('Failed to add location');
    }
  };

  const handleAddCategory = async (categoryName: string) => {
    try {
      const request: AddCategoryRequest = { name: categoryName };
      const response = await api.post<Category>('/api/categories', request);
      setCategories(prev => [...prev, response.data]);
    } catch (error) {
      throw new Error('Failed to add category');
    }
  };

  const project = projects.find(p => p.id === projectId);

  useEffect(() => {
    if (!projectId || !productId) return;

    const fetchProduct = async () => {
      try {
        setLoading(true);
        setError(null);
        // First get all products for the project, then find the specific one
        const response = await api.get<Product[]>(`/projects/${projectId}/products`);
        const foundProduct = response.data.find(p => p.id === productId);
        
        if (!foundProduct) {
          setError('Product not found');
        } else {
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
  }, [projectId, productId]);

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
  const updateProductField = async (field: keyof Product, value: string | number | string[]) => {
    if (!product) return;

    try {
      // For now, we'll update locally since there's no specific update API endpoint
      // In a real app, this would make an API call to update the specific field
      const updatedProduct = { ...product, [field]: value };
      setProduct(updatedProduct);
      
      // Here you would typically make an API call like:
      // await api.patch(`/projects/${projectId}/products/${productId}`, { [field]: value });
      
      console.log(`Updated ${field} to:`, value);
    } catch (err) {
      throw new Error(`Failed to update ${field}`);
    }
  };

  // Function to handle image uploads
  const handleImageUpload = async (file: File) => {
    if (!product) return;

    try {
      // For now, create a mock URL for the uploaded file
      // In a real implementation, you would upload to a server and get a URL back
      const imageUrl = URL.createObjectURL(file);
      
      // Update the product with the new image
      await updateProductField('custom_image_url', imageUrl);
      
      console.log('Image uploaded:', imageUrl);
    } catch (err) {
      throw new Error('Failed to upload image');
    }
  };

  if (!project) {
    return (
      <div className="page-container">
        <div className="product-page">
          <div className="error-state">
            <p>Project not found</p>
            <button 
              className="button button-secondary"
              onClick={() => navigate('/projects')}
            >
              Back to Projects
            </button>
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
              onClick={() => navigate(`/projects/${projectId}`)}
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
            <h1>{product.product_name || product.description || "Untitled Product"}</h1>
            <p className="project-breadcrumb">
              <span 
                className="breadcrumb-link"
                onClick={() => navigate(`/projects/${projectId}`)}
              >
                {project.name}
              </span>
              {' > '}
              <span>{product.description}</span>
            </p>
          </div>
          <button 
            className="button button-secondary"
            onClick={() => navigate(`/projects/${projectId}`)}
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
              {(product.custom_image_url || product.image) ? (
                <div className="main-image">
                  <div className="image-header">
                    <span className="image-label">
                      {product.custom_image_url ? 'Custom Image' : 'Original Image'}
                    </span>
                    {product.custom_image_url && (
                      <button
                        type="button"
                        className="button button-secondary button-small"
                        onClick={() => updateProductField('custom_image_url', '')}
                      >
                        Remove Custom Image
                      </button>
                    )}
                  </div>
                  <img 
                    src={product.custom_image_url || product.image} 
                    alt={product.description}
                  />
                </div>
              ) : (
                <div className="no-image-large">
                  <p>No Image Available</p>
                </div>
              )}
              
              {/* Image Upload Section */}
              <div className="image-upload-section">
                <h4>Upload New Image</h4>
                <FileUpload
                  onFileSelected={handleImageUpload}
                  accept="image/*"
                  maxSize={5 * 1024 * 1024} // 5MB
                />
                <p className="upload-help">Upload a new image for this product (max 5MB)</p>
              </div>
            </div>
            
            {/* Additional Images Gallery */}
            {product.images && product.images.length > 1 && (
              <div className="image-gallery">
                <h3>Additional Images</h3>
                <div className="gallery-grid">
                  {product.images.slice(1).map((image, index) => (
                    <div key={index} className="gallery-image">
                      <img src={image} alt={`${product.description} ${index + 2}`} />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="product-details">
            <div className="detail-section">
              <h2>Product Information</h2>
              <div className="editable-details">
                <EditableSection
                  label="Product Name"
                  value={product.product_name}
                  type="text"
                  placeholder="Enter product name"
                  onSave={(value) => updateProductField('product_name', value as string)}
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
                    onSelectionChange={(categories) => updateProductField('category', categories)}
                    availableCategories={categories}
                    onAddCategory={handleAddCategory}
                  />
                </div>
                
                <div className="editable-field">
                  <label className="editable-label">Locations</label>
                  <LocationMultiSelect
                    selectedLocations={Array.isArray(product.location) ? product.location : [product.location].filter(Boolean)}
                    onSelectionChange={(locations: string[]) => updateProductField('location', locations)}
                    availableLocations={locations}
                    onAddLocation={handleAddLocation}
                  />
                </div>

                <div className="detail-item static">
                  <label>Tag ID:</label>
                  <span>{product.tagId}</span>
                </div>
                
                <div className="detail-item static">
                  <label>Added:</label>
                  <span>{new Date(product.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h2>Description</h2>
              <EditableSection
                label="Product Description"
                value={product.description}
                type="textarea"
                placeholder="Enter product description"
                multiline={true}
                onSave={(value) => updateProductField('description', value as string)}
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
    </div>
  );
};

export default ProductPage;