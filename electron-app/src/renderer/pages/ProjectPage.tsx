import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useElectronProject } from '../contexts/ElectronProjectContext';
import { Product } from '../../shared/types';
import { api } from '../services/apiIPC';
import { formatArray, formatPrice } from '../utils/formatters';
import { TableSettingsModal, useTableSettings } from '../components/TableSettings';
import { getProductImageUrl, getPlaceholderImage } from '../../shared/utils/assetUtils';
import './ProjectPage.css';

// Types for persisted state
interface ProjectPageState {
  viewMode: 'grid' | 'list';
  groupBy: 'none' | 'location' | 'category' | 'manufacturer';
  sortBy: 'name' | 'date' | 'location' | 'manufacturer' | 'price' | 'category';
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
    
    if (parsed.sortBy === 'name' || parsed.sortBy === 'date' || parsed.sortBy === 'location' || 
        parsed.sortBy === 'manufacturer' || parsed.sortBy === 'price' || parsed.sortBy === 'category') {
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
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'location' | 'manufacturer' | 'price' | 'category'>(storedState.sortBy || 'date');
  const [filters, setFilters] = useState(storedState.filters || {
    search: '',
    category: '',
    location: '',
    manufacturer: ''
  });
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());

  // For the new file-based system, we only have one current project
  const currentProject = project;

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

  const updateSortBy = (sort: 'name' | 'date' | 'location' | 'manufacturer' | 'price' | 'category') => {
    setSortBy(sort);
    if (isInitialized) {
      saveState({ sortBy: sort });
    }
  };


  const updateFilters = (filterKey: keyof typeof filters, value: string | number | null) => {
    const newFilters = { ...filters, [filterKey]: value };
    setFilters(newFilters);
    if (isInitialized) {
      saveState({ filters: newFilters });
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
    if (isInitialized) {
      saveState({ filters: clearedFilters });
    }
  };

  // Helper function to filter products
  const filterProducts = (products: Product[]) => {
    return products.filter(product => {
      // Search filter - searches across product name, type, manufacturer
      if (filters.search.trim()) {
        const searchTerm = filters.search.toLowerCase().trim();
        const productName = (product.productName || '').toLowerCase();
        const type = (product.type || '').toLowerCase();
        const manufacturer = (product.manufacturer || '').toLowerCase();
        
        if (!productName.includes(searchTerm) && 
            !type.includes(searchTerm) && 
            !manufacturer.includes(searchTerm)) {
          return false;
        }
      }
      
      // Category filter - handles both string and array formats
      if (filters.category) {
        if (typeof product.category === 'string') {
          if (product.category !== filters.category) {
            return false;
          }
        } else {
          // Handle legacy array format
          const productCategories = Array.isArray(product.category) ? product.category : [product.category];
          if (!productCategories.includes(filters.category)) {
            return false;
          }
        }
      }
      
      // Location filter - handles array of locations
      if (filters.location) {
        const productLocations = Array.isArray(product.location) ? product.location : [product.location];
        if (!productLocations.includes(filters.location)) {
          return false;
        }
      }
      
      // Manufacturer filter
      if (filters.manufacturer && product.manufacturer !== filters.manufacturer) {
        return false;
      }
      
      
      return true;
    });
  };

  // Helper function to sort products
  const sortProducts = (products: Product[]) => {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'name': {
          const aName = a.productName || a.type || '';
          const bName = b.productName || b.type || '';
          return aName.localeCompare(bName);
        }
        case 'manufacturer': {
          const aManufacturer = a.manufacturer || '';
          const bManufacturer = b.manufacturer || '';
          return aManufacturer.localeCompare(bManufacturer);
        }
        case 'price': {
          const aPrice = a.price || 0;
          const bPrice = b.price || 0;
          return aPrice - bPrice;
        }
        case 'category': {
          const aCategory = typeof a.category === 'string' ? a.category : formatArray(a.category);
          const bCategory = typeof b.category === 'string' ? b.category : formatArray(b.category);
          return aCategory.localeCompare(bCategory);
        }
        case 'location': {
          const aLocation = formatArray(a.location);
          const bLocation = formatArray(b.location);
          return aLocation.localeCompare(bLocation);
        }
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  };

  // Helper function to group products by location
  const groupProductsByLocation = (products: Product[]) => {
    const filtered = filterProducts(products);
    const sorted = sortProducts(filtered);
    const grouped = sorted.reduce((acc, product) => {
      const locations = Array.isArray(product.location) && product.location.length > 0 
        ? product.location 
        : ['Unspecified'];
      
      // Add product to each location group (for multi-location support)
      locations.forEach(location => {
        if (!acc[location]) {
          acc[location] = [];
        }
        acc[location].push(product);
      });
      return acc;
    }, {} as Record<string, Product[]>);

    // Sort location keys alphabetically
    const sortedKeys = Object.keys(grouped).sort();
    const sortedGrouped: Record<string, Product[]> = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  };

  // Helper function to group products by category
  const groupProductsByCategory = (products: Product[]) => {
    const filtered = filterProducts(products);
    const sorted = sortProducts(filtered);
    const grouped = sorted.reduce((acc, product) => {
      const categories = Array.isArray(product.category) ? product.category : [product.category || 'Uncategorized'];
      categories.forEach(category => {
        const categoryKey = category || 'Uncategorized';
        if (!acc[categoryKey]) {
          acc[categoryKey] = [];
        }
        acc[categoryKey].push(product);
      });
      return acc;
    }, {} as Record<string, Product[]>);

    // Sort category keys alphabetically
    const sortedKeys = Object.keys(grouped).sort();
    const sortedGrouped: Record<string, Product[]> = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  };

  // Helper function to group products by manufacturer
  const groupProductsByManufacturer = (products: Product[]) => {
    const filtered = filterProducts(products);
    const sorted = sortProducts(filtered);
    const grouped = sorted.reduce((acc, product) => {
      const manufacturer = product.manufacturer || 'Unknown Manufacturer';
      if (!acc[manufacturer]) {
        acc[manufacturer] = [];
      }
      acc[manufacturer].push(product);
      return acc;
    }, {} as Record<string, Product[]>);

    // Sort manufacturer keys alphabetically
    const sortedKeys = Object.keys(grouped).sort();
    const sortedGrouped: Record<string, Product[]> = {};
    sortedKeys.forEach(key => {
      sortedGrouped[key] = grouped[key];
    });

    return sortedGrouped;
  };

  // Helper function to check if a product has multiple locations
  const isMultiLocationProduct = (product: Product) => {
    return Array.isArray(product.location) && product.location.length > 1;
  };

  // Helper function to get total location count for a product
  const getLocationCount = (product: Product) => {
    return Array.isArray(product.location) ? product.location.length : 1;
  };

  // Get unique values for filter dropdowns
  const uniqueCategories = [...new Set(products.flatMap(p => {
    if (typeof p.category === 'string') {
      return [p.category];
    }
    return Array.isArray(p.category) ? p.category : [p.category];
  }).filter(Boolean))].sort();
  const uniqueLocations = [...new Set(products.flatMap(p => Array.isArray(p.location) ? p.location : [p.location]).filter(Boolean))].sort();
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
  
  // Get organized products based on current settings
  const organizedProducts = (() => {
    switch (groupBy) {
      case 'location':
        return groupProductsByLocation(products);
      case 'category':
        return groupProductsByCategory(products);
      case 'manufacturer':
        return groupProductsByManufacturer(products);
      case 'none':
      default:
        return { 'All Products': sortProducts(filterProducts(products)) };
    }
  })();

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
    if (!currentProject) return;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get<Product[]>(`/api/projects/current/products`);
        setProducts(response.data);
      } catch (err) {
        setError('Failed to load products');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [currentProject]);

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

        {!loading && !error && products.length > 0 && (
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
                  onChange={(e) => updateSortBy(e.target.value as 'name' | 'date' | 'location' | 'manufacturer' | 'price' | 'category')}
                >
                  <option value="date">Date Added</option>
                  <option value="name">Product Name</option>
                  <option value="manufacturer">Manufacturer</option>
                  <option value="price">Price</option>
                  <option value="category">Category</option>
                  <option value="location">Location</option>
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
                  {uniqueCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
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
                  {uniqueLocations.map(location => (
                    <option key={location} value={location}>{location}</option>
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
                className="bulk-action-button secondary"
                onClick={() => {
                  // TODO: Implement bulk export
                  console.log('Exporting selected products:', Array.from(selectedProducts));
                }}
              >
                Export
              </button>
              <button 
                className="bulk-action-button danger"
                onClick={() => {
                  // TODO: Implement bulk delete
                  if (confirm(`Are you sure you want to delete ${selectedProducts.size} product${selectedProducts.size !== 1 ? 's' : ''}?`)) {
                    console.log('Deleting selected products:', Array.from(selectedProducts));
                    setSelectedProducts(new Set());
                    setSelectAll(false);
                  }
                }}
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
            <p>No products in this project yet.</p>
            <button 
              className="button button-primary"
              onClick={() => navigate('/project/products/new')}
            >
              Add First Product
            </button>
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
                        <p className="product-category">{typeof product.category === 'string' ? product.category : formatArray(product.category)}</p>
                        <div className="product-location-info">
                          <p className="product-location">{formatArray(product.location)}</p>
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
                                      <div className="list-product-image">
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
                                      <span>{product.tagId}</span>
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
                                      <span>{typeof product.category === 'string' ? product.category : formatArray(product.category)}</span>
                                    </td>
                                  );
                                case 'location':
                                  return (
                                    <td key={column.key} className="location-cell">
                                      <div className="table-location-info">
                                        <span>{formatArray(product.location)}</span>
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
        />
      </div>
    </div>
  );
};

export default ProjectPage;