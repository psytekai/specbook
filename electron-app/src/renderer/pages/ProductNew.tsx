import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectronProject } from '../contexts/ElectronProjectContext';
import { useToast } from '../hooks/useToast';
import { 
  handleApiError,
  api
} from '../services/apiIPC';
import { usePythonScraper } from '../hooks/usePythonScraper';
import { LocationMultiSelect } from '../components/LocationMultiSelect';
import { CategoryMultiSelect } from '../components/CategoryMultiSelect';
import { Location, Category, AddLocationRequest, AddCategoryRequest } from '../types';
import { getAssetUrl } from '../../shared/utils/assetUtils';
import './ProductNew.css';

const ProductNew: React.FC = () => {
  const navigate = useNavigate();
  // No projectId needed anymore since we only have one current project
  const { project, isLoading: projectLoading, isInitializing } = useElectronProject();
  const { showToast } = useToast();
  
  // API field names interface using camelCase
  interface ProductFormData {
    productUrl: string;
    tagId: string;
    productLocation: string[];
    productDescription: string;
    specificationDescription: string;
    category: string[];
    productName?: string;
    manufacturer?: string;
    price?: number;
    
    // Asset management - correct field names
    primaryImageHash?: string;
    primaryThumbnailHash?: string;
    additionalImagesHashes: string[];
  }

  const [formData, setFormData] = useState<ProductFormData>({
    productUrl: '',
    tagId: '',
    productLocation: [],
    productDescription: '',
    specificationDescription: '',
    category: [],
    additionalImagesHashes: []
  });
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasDetails, setHasDetails] = useState(false);
  const [locations, setLocations] = useState<Location[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);

  // Python scraper hook
  const { 
    scrapeProduct, 
    isLoading: isScrapingLoading, 
    progress: scrapingProgress,
    error: scrapingError,
    isAvailable: isPythonAvailable
  } = usePythonScraper();

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
        
        // Store asset hashes using correct field names
        setFormData(prev => ({
          ...prev,
          primaryImageHash: response.data.hash,
          primaryThumbnailHash: response.data.thumbnailHash
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
    
    const { productUrl } = formData;
    
    if (!productUrl) {
      showToast('Product URL is required', 'error');
      return;
    }

    if (!isPythonAvailable) {
      showToast('Python scraper is not available', 'error');
      return;
    }
    
    setIsLoading(true);
    
    try {
      const result = await scrapeProduct(productUrl, {
        method: 'auto',
        llm_model: 'gpt-4o-mini'
      });
      
      if (!result?.success) {
        throw new Error(result?.error || 'Failed to fetch product details');
      }
      
      if (result.data) {
        const data = result.data;

        // Handle image URL if provided
        let imageHash: string | undefined;
        let thumbnailHash: string | undefined;

        if (data.image_url) {
          try {
            console.log('🔄 Downloading scraped image:', data.image_url);
            showToast('Downloading product image...', 'info');

            // Generate filename from URL or use timestamp
            const urlParts = data.image_url.split('/');
            const originalName = urlParts[urlParts.length - 1] || 'scraped-image';
            const fileName = originalName.includes('.') ? originalName : `scraped-image-${Date.now()}.jpg`;

            // Download and store via main process (bypasses CSP restrictions)
            const downloadResult = await window.electronAPI.assetDownloadFromUrl(data.image_url, fileName);

            if (downloadResult.success) {
              imageHash = downloadResult.data.hash;
              thumbnailHash = downloadResult.data.thumbnailHash;
              console.log('✅ Scraped image downloaded and stored successfully:', downloadResult.data);
              showToast('Product image downloaded and processed successfully', 'success');
            } else {
              console.error('❌ Failed to download scraped image:', downloadResult.error);
              showToast('Failed to download product image', 'error');
            }
          } catch (error) {
            console.error('❌ Failed to download scraped image:', error);
            showToast('Failed to download product image - continuing without image', 'error');
            // Continue without image - not a blocking error
          }
        }

        setFormData(prev => ({
          ...prev,
          productDescription: data.description || '',
          specificationDescription: data.type || '',

          productName: data.model_no || '', // Use model_no as product name fallback
          manufacturer: '', // Not provided by Python scraper
          price: undefined, // Not provided by Python scraper

          // Set image hashes if successfully downloaded
          primaryImageHash: imageHash,
          primaryThumbnailHash: thumbnailHash
        }));
      }
      
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
    
    if (!formData.productUrl) {
      showToast('Product URL is required', 'error');
      return;
    }
    
    try {
      setIsSaving(true);
      
      // Submit with correct field names - no manual mapping needed
      await api.post('/api/products', {
        ...formData,
        projectId: 'current'
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
              <label htmlFor="productUrl" className="label">
                Product URL *
              </label>
              <input
                id="productUrl"
                name="productUrl"
                type="url"
                className="input"
                value={formData.productUrl}
                onChange={handleInputChange}
                placeholder="https://example.com/product"
                required
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="tagId" className="label">
                Tag ID *
              </label>
              <input
                id="tagId"
                name="tagId"
                type="text"
                className="input"
                value={formData.tagId}
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
                selectedLocations={formData.productLocation}
                onSelectionChange={(locations: string[]) => setFormData(prev => ({ ...prev, productLocation: locations }))}
                availableLocations={locations}
                onAddLocation={handleAddLocation}
                required={true}
              />
            </div>
            
            <button 
              type="submit" 
              className="button button-primary"
              disabled={isLoading || isScrapingLoading || isPythonAvailable !== true}
            >
              {isLoading || isScrapingLoading ? 'Fetching...' : 'Fetch Product Details'}
          </button>
          
          {/* Diagnostic button for debugging */}
          <button
            type="button"
            onClick={async () => {
              console.log('Running Python bridge diagnostics...');
              try {
                const result = await window.electronAPI.pythonRunDiagnostics();
                console.log('Diagnostic result:', result);
                alert(`Python Bridge Diagnostics:
Executable: ${result.executable}
Exists: ${result.exists}
Platform: ${result.platform}
Error: ${result.error || 'None'}
Exit Code: ${result.testResult?.exitCode}
Stdout: ${result.testResult?.stdout?.slice(0, 200) || 'Empty'}
Stderr: ${result.testResult?.stderr?.slice(0, 200) || 'Empty'}`);
              } catch (error) {
                console.error('Diagnostic error:', error);
                alert(`Diagnostic failed: ${error}`);
              }
            }}
            className="button"
            style={{ marginLeft: '10px', backgroundColor: '#ff9800' }}
          >
            Run Diagnostics
          </button>
            
            {/* Show scraping progress */}
            {scrapingProgress && (
              <div className="progress-info" style={{ marginTop: '10px', fontSize: '14px', color: '#666' }}>
                <div style={{ marginBottom: '5px' }}>
                  {scrapingProgress.message} ({scrapingProgress.progress * 100}%)
                </div>
                <div className="progress-bar" style={{ 
                  width: '100%', 
                  height: '4px', 
                  backgroundColor: '#e0e0e0', 
                  borderRadius: '2px',
                  overflow: 'hidden'
                }}>
                  <div style={{
                    width: `${scrapingProgress.progress * 100}%`,
                    height: '100%',
                    backgroundColor: '#007bff',
                    transition: 'width 0.3s ease'
                  }} />
                </div>
              </div>
            )}
            
            {/* Show Python availability status */}
            {isPythonAvailable === null && (
              <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#e3f2fd', border: '1px solid #90caf9', borderRadius: '4px', fontSize: '14px' }}>
                🔍 Checking Python bridge availability...
              </div>
            )}
            
            {isPythonAvailable === false && (
              <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#fff3cd', border: '1px solid #ffeaa7', borderRadius: '4px', fontSize: '14px' }}>
                ⚠️ Python scraper is not available. Please check the installation.
              </div>
            )}
            
            {/* Show scraping errors */}
            {scrapingError && (
              <div style={{ marginTop: '10px', padding: '8px', backgroundColor: '#f8d7da', border: '1px solid #f5c6cb', borderRadius: '4px', fontSize: '14px', color: '#721c24' }}>
                {scrapingError}
              </div>
            )}
          </div>
          
          {hasDetails && (
            <div className="form-section">
              <h2>Product Details</h2>
              
              {/* Image Display - Shows fetched image or custom image (prefer primary image) */}
              {(formData.primaryImageHash || formData.primaryThumbnailHash) && (
                <div className="form-group">
                  <label className="label">Product Image</label>
                  <div className="product-preview">
                    <img 
                      src={getAssetUrl(formData.primaryImageHash) || getAssetUrl(formData.primaryThumbnailHash)!}
                      alt="Product image" 
                      className="product-image"
                    />
                  </div>
                </div>
              )}

              {/* Image Upload Button */}
              <div className="form-group">
                <button
                  type="button"
                  className="button button-secondary"
                  onClick={handleCustomImageClick}
                  disabled={isUploading}
                >
                  {isUploading ? `Uploading... ${uploadProgress}%` : 'Upload Image'}
                </button>
              </div>
              
              <div className="form-group">
                <label htmlFor="productDescription" className="label">
                  Description
                </label>
                <textarea
                  id="productDescription"
                  name="productDescription"
                  className="input textarea"
                  value={formData.productDescription}
                  onChange={handleInputChange}
                  rows={4}
                />
              </div>
              
              <div className="form-group">
                <label htmlFor="specificationDescription" className="label">
                  Specifications
                </label>
                <textarea
                  id="specificationDescription"
                  name="specificationDescription"
                  className="input textarea"
                  value={formData.specificationDescription}
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