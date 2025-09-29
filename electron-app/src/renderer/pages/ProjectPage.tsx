import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectronProject } from '../contexts/ElectronProjectContext';
import { Product } from '../../shared/types';
import { Location, Category } from '../types';
import { api } from '../services/apiIPC';
import { formatArray, formatPrice } from '../utils/formatters';
import { TableSettingsModal, useTableSettings } from '../components/TableSettings';
import { getProductImageUrl, getPlaceholderImage } from '../../shared/utils/assetUtils';
import './ProjectPage.css';

// Types for persisted state
interface ProjectPageState {
  viewMode: 'grid' | 'list';
  groupBy: 'none' | 'location' | 'category' | 'manufacturer';
  sortBy: 'name' | 'date' | 'manufacturer' | 'price' | 'tagId';
  visibleColumns: {
    select: boolean;
    image: boolean;
    productName: boolean;
    type: boolean;
    manufacturer: boolean;
    price: boolean;
    category: boolean;
    location: boolean;
    tagId: boolean;
    actions: boolean;
  };
  filters: {
    search: string;
    category: string;
    location: string;
    manufacturer: string;
  };
  pagination: {
    page: number;
    limit: number;
  };
}


// Local storage utilities
const STORAGE_KEY = 'projectPage_preferences';

const getStoredState = (): Partial<ProjectPageState> => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    
    const parsed = JSON.parse(stored);
    
    // Validate the stored data
    const validatedState: Partial<ProjectPageState> = {};
    
    if (parsed.viewMode === 'grid' || parsed.viewMode === 'list') {
      validatedState.viewMode = parsed.viewMode;
    }
    
    if (parsed.groupBy === 'none' || parsed.groupBy === 'location' || 
        parsed.groupBy === 'category' || parsed.groupBy === 'manufacturer') {
      validatedState.groupBy = parsed.groupBy;
    }
    
    if (parsed.sortBy === 'name' || parsed.sortBy === 'date' || 
        parsed.sortBy === 'manufacturer' || parsed.sortBy === 'price' || parsed.sortBy === 'tagId') {
      validatedState.sortBy = parsed.sortBy;
    }
    
    // Validate visibleColumns
    if (parsed.visibleColumns && typeof parsed.visibleColumns === 'object') {
      const defaultColumns = {
        select: true,
        image: true,
        productName: true,
        type: true,
        manufacturer: true,
        price: true,
        category: true,
        location: true,
        tagId: true,
        actions: true
      };
      
      validatedState.visibleColumns = { ...defaultColumns };
      
      // Validate each column setting
      Object.keys(defaultColumns).forEach(key => {
        const columnKey = key as keyof typeof defaultColumns;
        if (typeof parsed.visibleColumns[columnKey] === 'boolean') {
          validatedState.visibleColumns![columnKey] = parsed.visibleColumns[columnKey];
        }
      });
    }
    
    // Validate filters
    if (parsed.filters && typeof parsed.filters === 'object') {
      const defaultFilters = {
        search: '',
        category: '',
        location: '',
        manufacturer: ''
      };
      
      validatedState.filters = { ...defaultFilters };
      
      // Validate each filter setting
      if (typeof parsed.filters.search === 'string') {
        validatedState.filters.search = parsed.filters.search;
      }
      if (typeof parsed.filters.category === 'string') {
        validatedState.filters.category = parsed.filters.category;
      }
      if (typeof parsed.filters.location === 'string') {
        validatedState.filters.location = parsed.filters.location;
      }
      if (typeof parsed.filters.manufacturer === 'string') {
        validatedState.filters.manufacturer = parsed.filters.manufacturer;
      }
    }
    
    // Validate pagination
    if (parsed.pagination && typeof parsed.pagination === 'object') {
      const defaultPagination = {
        page: 1,
        limit: 20
      };
      
      validatedState.pagination = { ...defaultPagination };
      
      // Validate pagination settings
      if (typeof parsed.pagination.page === 'number' && parsed.pagination.page > 0) {
        validatedState.pagination.page = parsed.pagination.page;
      }
      if (typeof parsed.pagination.limit === 'number' && parsed.pagination.limit > 0 && parsed.pagination.limit <= 100) {
        validatedState.pagination.limit = parsed.pagination.limit;
      }
    }
    
    return validatedState;
  } catch (error) {
    console.warn('Failed to load project page preferences:', error);
    return {};
  }
};

const saveState = (state: Partial<ProjectPageState>) => {
  try {
    const current = getStoredState();
    const updated = { ...current, ...state };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (error) {
    console.warn('Failed to save project page preferences:', error);
  }
};

const ProjectPage: React.FC = () => {
  const navigate = useNavigate();
  const { project, isLoading: projectLoading, isInitializing } = useElectronProject();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showTableSettings, setShowTableSettings] = useState(false);
  const [selectAll, setSelectAll] = useState(false);

  // Initialize TableSettings hook
  const tableSettings = useTableSettings({ 
    projectId: 'current',
    initialSettings: {
      // Use default settings for now
    }
  });

  // Initialize state from localStorage with fallback defaults
  const storedState = getStoredState();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(storedState.viewMode || 'list');
  const [groupBy, setGroupBy] = useState<'none' | 'location' | 'category' | 'manufacturer'>(storedState.groupBy || 'none');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'manufacturer' | 'price' | 'tagId'>(storedState.sortBy || 'date');
  const [filters, setFilters] = useState(storedState.filters || {
    search: '',
    category: '',  // This will now store category ID
    location: '',  // This will now store location ID
    manufacturer: ''
  });
  const [pagination, setPagination] = useState(storedState.pagination || {
    page: 1,
    limit: 20
  });
  const [paginationInfo, setPaginationInfo] = useState({
    total: 0,
    pages: 0
  });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // For the new file-based system, we only have one current project
  const currentProject = project;

  // Helper functions to map IDs to names
  const getCategoryName = (categoryId: string): string => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId; // Fallback to ID if name not found
  };

  const getLocationName = (locationId: string): string => {
    const location = locations.find(loc => loc.id === locationId);
    return location ? location.name : locationId; // Fallback to ID if name not found
  };

  const getCategoryNames = (categoryIds: string[]): string[] => {
    return categoryIds.map(id => getCategoryName(id));
  };

  const getLocationNames = (locationIds: string[]): string[] => {
    return locationIds.map(id => getLocationName(id));
  };

  // Fetch data with pagination and filters
  const fetchData = useCallback(async () => {
    if (!currentProject) return;

    try {
      setLoading(true);
      setError(null);
      
      // Build API parameters
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        sortBy,
        groupBy: groupBy !== 'none' ? groupBy : undefined,
        ...filters
      };

      // Fetch products with pagination, categories, and locations in parallel
      const [productsResponse, categoriesResponse, locationsResponse] = await Promise.all([
        api.get<Product[]>(`/api/projects/current/products`, params),
        api.get<Category[]>('/api/categories'),
        api.get<Location[]>('/api/locations')
      ]);
      
      if (productsResponse.success && productsResponse.data && productsResponse.pagination) {
        setProducts(productsResponse.data);
        setPaginationInfo({
          total: productsResponse.pagination.total,
          pages: productsResponse.pagination.pages
        });
      } else {
        throw new Error('Failed to fetch products');
      }
      
      setCategories(categoriesResponse.data);
      setLocations(locationsResponse.data);
    } catch (err) {
      setError('Failed to load data');
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
    }
  }, [currentProject, pagination, sortBy, groupBy, filters]);

  // Handlers for managing categories and locations from table settings
  const handleAddCategory = useCallback(async (categoryName: string): Promise<Category> => {
    try {
      const response = await api.post<Category>('/api/categories', { name: categoryName });
      setCategories(prev => [...prev, response.data]);
      return response.data;
    } catch (error) {
      throw new Error('Failed to add category');
    }
  }, []);

  const handleUpdateCategory = useCallback(async (id: string, name: string): Promise<Category> => {
    try {
      const response = await api.put<Category>(`/api/categories/${id}`, { name });
      setCategories(prev => prev.map(cat => cat.id === id ? response.data : cat));
      return response.data;
    } catch (error) {
      throw new Error('Failed to update category');
    }
  }, []);

  const handleDeleteCategory = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/api/categories/${id}`);
      setCategories(prev => prev.filter(cat => cat.id !== id));
      // Refresh products to reflect the changes
      await fetchData();
      return true;
    } catch (error) {
      throw new Error('Failed to delete category');
    }
  }, [fetchData]);

  const handleAddLocation = useCallback(async (locationName: string): Promise<Location> => {
    try {
      const response = await api.post<Location>('/api/locations', { name: locationName });
      setLocations(prev => [...prev, response.data]);
      return response.data;
    } catch (error) {
      throw new Error('Failed to add location');
    }
  }, []);

  const handleUpdateLocation = useCallback(async (id: string, name: string): Promise<Location> => {
    try {
      const response = await api.put<Location>(`/api/locations/${id}`, { name });
      setLocations(prev => prev.map(loc => loc.id === id ? response.data : loc));
      return response.data;
    } catch (error) {
      throw new Error('Failed to update location');
    }
  }, []);

  const handleDeleteLocation = useCallback(async (id: string): Promise<boolean> => {
    try {
      await api.delete(`/api/locations/${id}`);
      setLocations(prev => prev.filter(loc => loc.id !== id));
      // Refresh products to reflect the changes
      await fetchData();
      return true;
    } catch (error) {
      throw new Error('Failed to delete location');
    }
  }, [fetchData]);

  // Redirect to welcome page if no project is open
  useEffect(() => {
    // Don't redirect during initialization
    if (!isInitializing && !projectLoading && !project) {
      navigate('/welcome');
    }
  }, [project, projectLoading, isInitializing, navigate]);

  // State update functions that persist to localStorage
  const updateViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (isInitialized) {
      saveState({ viewMode: mode });
    }
  };

  const updateGroupBy = (group: 'none' | 'location' | 'category' | 'manufacturer') => {
    setGroupBy(group);
    if (isInitialized) {
      saveState({ groupBy: group });
    }
  };

  const updateSortBy = (sort: 'name' | 'date' | 'manufacturer' | 'price' | 'tagId') => {
    setSortBy(sort);
    if (isInitialized) {
      saveState({ sortBy: sort });
    }
  };


  const updateFilters = (filterKey: keyof typeof filters, value: string | number | null) => {
    const newFilters = { ...filters, [filterKey]: value };
    setFilters(newFilters);
    // Reset to first page when filters change
    const newPagination = { ...pagination, page: 1 };
    setPagination(newPagination);
    if (isInitialized) {
      saveState({ filters: newFilters, pagination: newPagination });
    }
  };

  const clearFilters = () => {
    const clearedFilters = {
      search: '',
      category: '',
      location: '',
      manufacturer: ''
    };
    setFilters(clearedFilters);
    // Reset to first page when filters are cleared
    const newPagination = { ...pagination, page: 1 };
    setPagination(newPagination);
    if (isInitialized) {
      saveState({ filters: clearedFilters, pagination: newPagination });
    }
  };

  const updatePagination = (updates: Partial<typeof pagination>) => {
    const newPagination = { ...pagination, ...updates };
    setPagination(newPagination);
    if (isInitialized) {
      saveState({ pagination: newPagination });
    }
  };

  // Since filtering, sorting, and grouping are now handled by the backend,
  // we just need to organize the already-processed products for display

  // Helper function to check if a product has multiple locations
  const isMultiLocationProduct = (product: Product) => {
    return Array.isArray(product.location) && product.location.length > 1;
  };

  // Helper function to get total location count for a product
  const getLocationCount = (product: Product) => {
    return Array.isArray(product.location) ? product.location.length : 1;
  };

  // For manufacturers, we'll need to get this from the backend as well
  // For now, we'll use what we have in the current page
  const uniqueManufacturers = [...new Set(products.map(p => p.manufacturer).filter(Boolean))].sort();

  // Selection handlers
  const handleSelectProduct = (productId: string, checked: boolean) => {
    const newSelected = new Set(selectedProducts);
    if (checked) {
      newSelected.add(productId);
    } else {
      newSelected.delete(productId);
    }
    setSelectedProducts(newSelected);
    
    // Update select all state
    const currentPageProducts = Object.values(organizedProducts).flat();
    const allSelected = currentPageProducts.every(p => newSelected.has(p.id));
    setSelectAll(allSelected);
  };

  const handleSelectAll = (checked: boolean) => {
    const currentPageProducts = Object.values(organizedProducts).flat();
    const newSelected = new Set(selectedProducts);
    
    if (checked) {
      currentPageProducts.forEach(p => newSelected.add(p.id));
    } else {
      currentPageProducts.forEach(p => newSelected.delete(p.id));
    }
    
    setSelectedProducts(newSelected);
    setSelectAll(checked);
  };

  const handleBulkDelete = useCallback(async () => {
    if (confirm(`Are you sure you want to delete ${selectedProducts.size} product${selectedProducts.size !== 1 ? 's' : ''}?`)) {
      try {
        // Delete each selected product
        const deletePromises = Array.from(selectedProducts).map(productId => 
          api.delete(`/api/products/${productId}`)
        );
        
        await Promise.all(deletePromises);
        
        // Refresh the products list
        await fetchData();
        
        // Clear selection
        setSelectedProducts(new Set());
        setSelectAll(false);
        
        console.log(`Successfully deleted ${deletePromises.length} product${deletePromises.length !== 1 ? 's' : ''}`);
      } catch (error) {
        console.error('Failed to delete products:', error);
        alert('Failed to delete some products. Please try again.');
      }
    }
  }, [selectedProducts, fetchData]);
  
  // Since backend handles grouping, we just display the products as returned
  // The backend will return products already filtered, sorted, and grouped
  const organizedProducts = groupBy === 'none' 
    ? { 'All Products': products }
    : { [groupBy]: products }; // Backend should handle proper grouping

  // Mark component as initialized after first render
  useEffect(() => {
    setIsInitialized(true);
  }, []);

  // Log preference changes for debugging (optional)
  useEffect(() => {
    if (isInitialized) {
      console.log('ProjectPage preferences updated:', { viewMode, groupBy, sortBy });
    }
  }, [viewMode, groupBy, sortBy, isInitialized]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Show loading state while checking for project
  if (isInitializing || projectLoading || !currentProject) {
    return (
      <div className="page-container">
        <div className="project-page">
          <div className="loading-state">
            <p>{isInitializing ? 'Initializing...' : 'Loading project...'}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="project-page">
        <div className="page-header">
          <div>
            <h1>{currentProject.name}</h1>
            <p className="project-meta">
              Created: {new Date(currentProject.createdAt || new Date()).toLocaleDateString()} | 
              Updated: {new Date(currentProject.updatedAt || new Date()).toLocaleDateString()}
            </p>
          </div>
          <div className="header-actions">
            <button 
              className="button button-primary"
              onClick={() => navigate('/project/products/new')}
            >
              Add Product
            </button>
          </div>
        </div>

        {!loading && !error && (
          <div className="controls-bar">
            <div className="sort-controls">
              <div className="control-group">
                <label className="control-label">Group by:</label>
                <select
                  className="control-select"
                  value={groupBy}
                  onChange={(e) => updateGroupBy(e.target.value as 'none' | 'location' | 'category' | 'manufacturer')}
                >
                  <option value="none">None</option>
                  <option value="location">Location</option>
                  <option value="category">Category</option>
                  <option value="manufacturer">Manufacturer</option>
                </select>
              </div>
              
              <div className="control-group">
                <label className="control-label">Sort by:</label>
                <select
                  className="control-select"
                  value={sortBy}
                  onChange={(e) => updateSortBy(e.target.value as 'name' | 'date' | 'manufacturer' | 'price' | 'tagId')}
                >
                  <option value="date">Date Added</option>
                  <option value="name">Product Name</option>
                  <option value="tagId">Tag ID</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="price">Price</option>
                </select>
              </div>
              
              <div className="control-group">
                <label className="control-label">Category:</label>
                <select
                  className="control-select"
                  value={filters.category}
                  onChange={(e) => updateFilters('category', e.target.value)}
                >
                  <option value="">All</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="control-group">
                <label className="control-label">Location:</label>
                <select
                  className="control-select"
                  value={filters.location}
                  onChange={(e) => updateFilters('location', e.target.value)}
                >
                  <option value="">All</option>
                  {locations.map(location => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </div>
              
              <div className="control-group">
                <label className="control-label">Manufacturer:</label>
                <select
                  className="control-select"
                  value={filters.manufacturer}
                  onChange={(e) => updateFilters('manufacturer', e.target.value)}
                >
                  <option value="">All</option>
                  {uniqueManufacturers.map(manufacturer => (
                    <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                  ))}
                </select>
              </div>
              
              <div className="control-group">
                <input
                  type="text"
                  className="control-select search-input"
                  placeholder="Search..."
                  value={filters.search}
                  onChange={(e) => updateFilters('search', e.target.value)}
                />
              </div>
            </div>

            <div className="view-controls">
              {(filters.search || filters.category || filters.location || filters.manufacturer) && (
                <button
                  className="button button-secondary button-small clear-filters-button"
                  onClick={clearFilters}
                  title="Clear all filters"
                >
                  Clear Filters
                </button>
              )}
              
              <div className="view-toggle">
                <button
                  className={`toggle-button ${viewMode === 'grid' ? 'active' : ''}`}
                  onClick={() => updateViewMode('grid')}
                  title="Grid view"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <rect x="3" y="3" width="6" height="6" strokeWidth="2"/>
                    <rect x="11" y="3" width="6" height="6" strokeWidth="2"/>
                    <rect x="3" y="11" width="6" height="6" strokeWidth="2"/>
                    <rect x="11" y="11" width="6" height="6" strokeWidth="2"/>
                  </svg>
                </button>
                <button
                  className={`toggle-button ${viewMode === 'list' ? 'active' : ''}`}
                  onClick={() => updateViewMode('list')}
                  title="List view"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <rect x="3" y="4" width="14" height="2" strokeWidth="2"/>
                    <rect x="3" y="9" width="14" height="2" strokeWidth="2"/>
                    <rect x="3" y="14" width="14" height="2" strokeWidth="2"/>
                  </svg>
                </button>
              </div>
              
              <button
                className="table-settings-button toggle-button"
                onClick={() => setShowTableSettings(true)}
                title="Table Settings"
                aria-label="Open table settings"
              >
                <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="10" cy="10" r="2"/>
                  <path d="M19 10a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H1m9 9a9 9 0 01-9-9m9 9v-2m-9-7a9 9 0 019-9v2"/>
                </svg>
                Settings
              </button>
            </div>
          </div>
        )}


        {!loading && !error && selectedProducts.size > 0 && (
          <div className="bulk-actions-toolbar">
            <div className="bulk-actions-info">
              <span>{selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected</span>
            </div>
            <div className="bulk-actions-buttons">
              <button 
                className="bulk-action-button danger"
                onClick={handleBulkDelete}
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="loading-state">
            <p>Loading products...</p>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
          </div>
        ) : products.length === 0 ? (
          <div className="empty-state">
            {(filters.search || filters.category || filters.location || filters.manufacturer) ? (
              <>
                <p>No products match the current filters.</p>
                <button 
                  className="button button-secondary"
                  onClick={clearFilters}
                >
                  Clear Filters
                </button>
              </>
            ) : (
              <>
                <p>No products in this project yet.</p>
                <button 
                  className="button button-primary"
                  onClick={() => navigate('/project/products/new')}
                >
                  Add First Product
                </button>
              </>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="products-container">
            {Object.entries(organizedProducts).map(([locationName, locationProducts]) => (
              <div key={locationName} className="product-group">
                {groupBy !== 'none' && (
                  <div className="group-header">
                    <h3 className="group-title">{locationName}</h3>
                    <div className="group-info">
                      <span className="group-count">({locationProducts.length} products)</span>
                      {groupBy === 'location' && (() => {
                        const multiLocationCount = locationProducts.filter(p => isMultiLocationProduct(p)).length;
                        return multiLocationCount > 0 ? (
                          <span className="multi-location-info" title={`${multiLocationCount} products appear in multiple locations`}>
                            📍 {multiLocationCount} multi-location
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
                <div className="products-grid">
                  {locationProducts.map(product => (
                    <div key={product.id} className="product-card">
                      <div className="product-image">
                        <img 
                          src={getProductImageUrl(product) || getPlaceholderImage()} 
                          alt={product.type || 'Product image'}
                          className="w-full h-48 object-cover"
                        />
                      </div>
                      <div className="product-info">
                        <h3 className="product-title">{product.productName || product.type}</h3>
                        <p className="product-type">{product.type}</p>
                        {product.manufacturer && <p className="product-manufacturer">By: {product.manufacturer}</p>}
                        {product.price && <p className="product-price">{formatPrice(product.price)}</p>}
                        <p className="product-category">{formatArray(getCategoryNames(Array.isArray(product.category) ? product.category : [product.category].filter(Boolean)))}</p>
                        <div className="product-location-info">
                          <p className="product-location">{formatArray(getLocationNames(Array.isArray(product.location) ? product.location : [product.location].filter(Boolean)))}</p>
                          {isMultiLocationProduct(product) && groupBy === 'location' && (
                            <span className="multi-location-badge" title={`This product appears in ${getLocationCount(product)} locations`}>
                              📍 {getLocationCount(product)}
                            </span>
                          )}
                        </div>
                        <div className="product-actions">
                          <button
                            className="product-link button-link"
                            onClick={() => navigate(`/project/products/${product.id}`)}
                          >
                            View Details →
                          </button>
                          <a 
                            href={product.url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="product-link external-link"
                          >
                            Source →
                          </a>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="products-container">
            {Object.entries(organizedProducts).map(([locationName, locationProducts]) => (
              <div key={locationName} className={`product-group ${groupBy !== 'none' ? 'grouped' : ''}`}>
                {groupBy !== 'none' && (
                  <div className="group-header">
                    <h3 className="group-title">{locationName}</h3>
                    <div className="group-info">
                      <span className="group-count">({locationProducts.length} products)</span>
                      {groupBy === 'location' && (() => {
                        const multiLocationCount = locationProducts.filter(p => isMultiLocationProduct(p)).length;
                        return multiLocationCount > 0 ? (
                          <span className="multi-location-info" title={`${multiLocationCount} products appear in multiple locations`}>
                            📍 {multiLocationCount} multi-location
                          </span>
                        ) : null;
                      })()}
                    </div>
                  </div>
                )}
                <div className="products-list">
                  <div className="table-container">
                    <table className="product-table">
                      <thead>
                        <tr>
                          {tableSettings.orderedColumns.filter(col => col.visible).map(column => {
                            switch (column.key) {
                              case 'select':
                                return (
                                  <th key={column.key} className="select-header">
                                    <input
                                      type="checkbox"
                                      className="row-checkbox"
                                      checked={selectAll}
                                      onChange={(e) => handleSelectAll(e.target.checked)}
                                    />
                                  </th>
                                );
                              case 'image':
                                return <th key={column.key} className="image-header">Image</th>;
                              case 'tagId':
                                return <th key={column.key} className="tagid-header">Tag ID</th>;
                              case 'productName':
                                return <th key={column.key} className="product-name-header">Product Name</th>;
                              case 'type':
                                return <th key={column.key} className="type-header">Type</th>;
                              case 'manufacturer':
                                return <th key={column.key} className="manufacturer-header">Manufacturer</th>;
                              case 'price':
                                return <th key={column.key} className="price-header">Price</th>;
                              case 'category':
                                return <th key={column.key} className="category-header">Category</th>;
                              case 'location':
                                return <th key={column.key} className="location-header">Location</th>;
                              case 'actions':
                                return <th key={column.key} className="actions-header">Actions</th>;
                              default:
                                return null;
                            }
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {locationProducts.map(product => (
                          <tr key={product.id} className="table-row">
                            {tableSettings.orderedColumns.filter(col => col.visible).map(column => {
                              switch (column.key) {
                                case 'select':
                                  return (
                                    <td key={column.key} className="select-cell">
                                      <input
                                        type="checkbox"
                                        className="row-checkbox"
                                        checked={selectedProducts.has(product.id)}
                                        onChange={(e) => handleSelectProduct(product.id, e.target.checked)}
                                      />
                                    </td>
                                  );
                                case 'image':
                                  return (
                                    <td key={column.key} className="image-cell">
                                      <div 
                                        className="list-product-image"
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/project/products/${product.id}`)}
                                      >
                                        <img 
                                          src={getProductImageUrl(product) || getPlaceholderImage()} 
                                          alt={product.type || 'Product image'}
                                        />
                                      </div>
                                    </td>
                                  );
                                case 'tagId':
                                  return (
                                    <td key={column.key} className="tagid-cell">
                                      <span 
                                        style={{ cursor: 'pointer' }}
                                        onClick={() => navigate(`/project/products/${product.id}`)}
                                      >
                                        {product.tagId}
                                      </span>
                                    </td>
                                  );
                                case 'productName':
                                  return (
                                    <td key={column.key} className="product-name-cell">
                                      <span className="product-name">{product.productName || 'N/A'}</span>
                                    </td>
                                  );
                                case 'type':
                                  return (
                                    <td key={column.key} className="type-cell">
                                      <span className="product-type">{product.type}</span>
                                    </td>
                                  );
                                case 'manufacturer':
                                  return (
                                    <td key={column.key} className="manufacturer-cell">
                                      <span>{product.manufacturer || 'N/A'}</span>
                                    </td>
                                  );
                                case 'price':
                                  return (
                                    <td key={column.key} className="price-cell">
                                      <span>{formatPrice(product.price)}</span>
                                    </td>
                                  );
                                case 'category':
                                  return (
                                    <td key={column.key} className="category-cell">
                                      <span>{formatArray(getCategoryNames(Array.isArray(product.category) ? product.category : [product.category].filter(Boolean)))}</span>
                                    </td>
                                  );
                                case 'location':
                                  return (
                                    <td key={column.key} className="location-cell">
                                      <div className="table-location-info">
                                        <span>{formatArray(getLocationNames(Array.isArray(product.location) ? product.location : [product.location].filter(Boolean)))}</span>
                                        {isMultiLocationProduct(product) && groupBy === 'location' && (
                                          <span className="multi-location-badge table-badge" title={`This product appears in ${getLocationCount(product)} locations`}>
                                            📍 {getLocationCount(product)}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                  );
                                case 'actions':
                                  return (
                                    <td key={column.key} className="actions-cell">
                                      <div className="list-actions">
                                        <button
                                          className="action-button primary"
                                          onClick={() => navigate(`/project/products/${product.id}`)}
                                        >
                                          View
                                        </button>
                                        <a 
                                          href={product.url} 
                                          target="_blank" 
                                          rel="noopener noreferrer"
                                          className="action-button secondary"
                                        >
                                          Source
                                        </a>
                                      </div>
                                    </td>
                                  );
                                default:
                                  return null;
                              }
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

                {/* Pagination Controls */}
                {!loading && !error && paginationInfo.pages > 1 && (
          <div className="pagination-container">
            <div className="pagination-info">
              <span>
                Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, paginationInfo.total)} of {paginationInfo.total} products
              </span>
            </div>
            <div className="pagination-controls">
              <button
                className="pagination-button"
                disabled={pagination.page <= 1}
                onClick={() => updatePagination({ page: 1 })}
                title="First page"
              >
                ««
              </button>
              <button
                className="pagination-button"
                disabled={pagination.page <= 1}
                onClick={() => updatePagination({ page: pagination.page - 1 })}
                title="Previous page"
              >
                ‹
              </button>
              
              {/* Page numbers */}
              {(() => {
                const currentPage = pagination.page;
                const totalPages = paginationInfo.pages;
                const pages = [];
                
                // Always show first page
                if (currentPage > 3) {
                  pages.push(1);
                  if (currentPage > 4) pages.push('...');
                }
                
                // Show pages around current page
                for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
                  pages.push(i);
                }
                
                // Always show last page
                if (currentPage < totalPages - 2) {
                  if (currentPage < totalPages - 3) pages.push('...');
                  pages.push(totalPages);
                }
                
                return pages.map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                  ) : (
                    <button
                      key={page}
                      className={`pagination-button ${page === currentPage ? 'active' : ''}`}
                      onClick={() => updatePagination({ page: page as number })}
                    >
                      {page}
                    </button>
                  )
                ));
              })()}
              
              <button
                className="pagination-button"
                disabled={pagination.page >= paginationInfo.pages}
                onClick={() => updatePagination({ page: pagination.page + 1 })}
                title="Next page"
              >
                ›
              </button>
              <button
                className="pagination-button"
                disabled={pagination.page >= paginationInfo.pages}
                onClick={() => updatePagination({ page: paginationInfo.pages })}
                title="Last page"
              >
                »»
              </button>
            </div>
            <div className="pagination-size">
              <label>
                Items per page:
                <select
                  value={pagination.limit}
                  onChange={(e) => updatePagination({ page: 1, limit: parseInt(e.target.value) })}
                  className="pagination-size-select"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </label>
            </div>
          </div>
        )}

        {/* Table Settings Modal */}
        <TableSettingsModal
          isOpen={showTableSettings}
          onClose={() => setShowTableSettings(false)}
          settings={tableSettings.settings}
          onApply={(newSettings) => {
            tableSettings.updateSettings(newSettings);
            setShowTableSettings(false);
          }}
          onReset={() => {
            tableSettings.resetSettings();
          }}
          locations={locations}
          categories={categories}
          onAddLocation={handleAddLocation}
          onUpdateLocation={handleUpdateLocation}
          onDeleteLocation={handleDeleteLocation}
          onAddCategory={handleAddCategory}
          onUpdateCategory={handleUpdateCategory}
          onDeleteCategory={handleDeleteCategory}
        />
      </div>
    </div>
  );
};

export default ProjectPage;