import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { Product } from '../types';
import { api } from '../services/api';
import { formatArray, formatPrice } from '../utils/formatters';
import './ProjectPage.css';

// Types for persisted state
interface ProjectPageState {
  viewMode: 'grid' | 'list';
  groupBy: 'none' | 'location' | 'category' | 'manufacturer';
  sortBy: 'name' | 'date' | 'location' | 'manufacturer' | 'price' | 'category';
  visibleColumns: {
    image: boolean;
    productName: boolean;
    description: boolean;
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
    priceMin: number | null;
    priceMax: number | null;
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
        image: true,
        productName: true,
        description: true,
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
        manufacturer: '',
        priceMin: null,
        priceMax: null
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
      if (typeof parsed.filters.priceMin === 'number' || parsed.filters.priceMin === null) {
        validatedState.filters.priceMin = parsed.filters.priceMin;
      }
      if (typeof parsed.filters.priceMax === 'number' || parsed.filters.priceMax === null) {
        validatedState.filters.priceMax = parsed.filters.priceMax;
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
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [showColumnPicker, setShowColumnPicker] = useState(false);

  // Initialize state from localStorage with fallback defaults
  const storedState = getStoredState();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(storedState.viewMode || 'list');
  const [groupBy, setGroupBy] = useState<'none' | 'location' | 'category' | 'manufacturer'>(storedState.groupBy || 'none');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'location' | 'manufacturer' | 'price' | 'category'>(storedState.sortBy || 'date');
  const [visibleColumns, setVisibleColumns] = useState(storedState.visibleColumns || {
    image: true,
    productName: true,
    description: true,
    manufacturer: true,
    price: true,
    category: true,
    location: true,
    tagId: true,
    actions: true
  });
  const [filters, setFilters] = useState(storedState.filters || {
    search: '',
    category: '',
    location: '',
    manufacturer: '',
    priceMin: null,
    priceMax: null
  });
  const [showFilters, setShowFilters] = useState(false);

  const project = projects.find(p => p.id === projectId);

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

  const updateVisibleColumns = (columnKey: keyof typeof visibleColumns, visible: boolean) => {
    const newVisibleColumns = { ...visibleColumns, [columnKey]: visible };
    setVisibleColumns(newVisibleColumns);
    if (isInitialized) {
      saveState({ visibleColumns: newVisibleColumns });
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
      manufacturer: '',
      priceMin: null,
      priceMax: null
    };
    setFilters(clearedFilters);
    if (isInitialized) {
      saveState({ filters: clearedFilters });
    }
  };

  // Helper function to filter products
  const filterProducts = (products: Product[]) => {
    return products.filter(product => {
      // Search filter - searches across product name, description, manufacturer
      if (filters.search.trim()) {
        const searchTerm = filters.search.toLowerCase().trim();
        const productName = (product.product_name || '').toLowerCase();
        const description = product.description.toLowerCase();
        const manufacturer = (product.manufacturer || '').toLowerCase();
        
        if (!productName.includes(searchTerm) && 
            !description.includes(searchTerm) && 
            !manufacturer.includes(searchTerm)) {
          return false;
        }
      }
      
      // Category filter - handles array of categories
      if (filters.category) {
        const productCategories = Array.isArray(product.category) ? product.category : [product.category];
        if (!productCategories.includes(filters.category)) {
          return false;
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
      
      // Price range filters
      if (filters.priceMin !== null && (product.price || 0) < filters.priceMin) {
        return false;
      }
      
      if (filters.priceMax !== null && (product.price || 0) > filters.priceMax) {
        return false;
      }
      
      return true;
    });
  };

  // Helper function to sort products
  const sortProducts = (products: Product[]) => {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          const aName = a.product_name || a.description;
          const bName = b.product_name || b.description;
          return aName.localeCompare(bName);
        case 'manufacturer':
          const aManufacturer = a.manufacturer || '';
          const bManufacturer = b.manufacturer || '';
          return aManufacturer.localeCompare(bManufacturer);
        case 'price':
          const aPrice = a.price || 0;
          const bPrice = b.price || 0;
          return aPrice - bPrice;
        case 'category': {
          const aCategory = formatArray(a.category);
          const bCategory = formatArray(b.category);
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
  const uniqueCategories = [...new Set(products.flatMap(p => Array.isArray(p.category) ? p.category : [p.category]).filter(Boolean))].sort();
  const uniqueLocations = [...new Set(products.flatMap(p => Array.isArray(p.location) ? p.location : [p.location]).filter(Boolean))].sort();
  const uniqueManufacturers = [...new Set(products.map(p => p.manufacturer).filter(Boolean))].sort();
  
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
    if (!projectId) return;

    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await api.get<Product[]>(`/projects/${projectId}/products`);
        setProducts(response.data);
      } catch (err) {
        setError('Failed to load products');
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, [projectId]);

  if (!project) {
    return (
      <div className="page-container">
        <div className="project-page">
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

  return (
    <div className="page-container">
      <div className="project-page">
        <div className="page-header">
          <div>
            <h1>{project.name}</h1>
            <p className="project-meta">
              Created: {new Date(project.createdAt).toLocaleDateString()} | 
              Updated: {new Date(project.updatedAt).toLocaleDateString()}
            </p>
          </div>
          <div className="header-actions">
            <button 
              className="button button-primary"
              onClick={() => navigate(`/projects/${projectId}/products/new`)}
            >
              Add Product
            </button>
            <button 
              className="button button-secondary"
              onClick={() => navigate('/projects')}
            >
              Back to Projects
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
            </div>

            <div className="view-controls">
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
              
              <div className="table-controls">
                <button
                  className="toggle-button filter-button"
                  onClick={() => setShowFilters(!showFilters)}
                  title="Filter products"
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                    <path d="M3 6h14l-4 4v6l-2-2v-4L3 6z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  {(filters.search || filters.category || filters.location || filters.manufacturer || 
                    filters.priceMin !== null || filters.priceMax !== null) && (
                    <span className="filter-indicator">•</span>
                  )}
                </button>
                
                {viewMode === 'list' && (
                  <div className="column-picker">
                    <button
                      className="toggle-button column-button"
                      onClick={() => setShowColumnPicker(!showColumnPicker)}
                      title="Column visibility"
                    >
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                        <rect x="3" y="3" width="14" height="2" strokeWidth="2"/>
                        <rect x="3" y="7" width="14" height="2" strokeWidth="2"/>
                        <rect x="3" y="11" width="14" height="2" strokeWidth="2"/>
                        <rect x="3" y="15" width="14" height="2" strokeWidth="2"/>
                      </svg>
                    </button>
                    
                    {showColumnPicker && (
                      <div className="column-picker-dropdown">
                        <div className="column-picker-header">
                          <span>Show/Hide Columns</span>
                        </div>
                        <div className="column-options">
                          {Object.entries({
                            image: 'Image',
                            productName: 'Product Name',
                            description: 'Description',
                            manufacturer: 'Manufacturer',
                            price: 'Price',
                            category: 'Category',
                            location: 'Location',
                            tagId: 'Tag ID'
                          }).map(([key, label]) => (
                            <label key={key} className="column-option">
                              <input
                                type="checkbox"
                                checked={visibleColumns[key as keyof typeof visibleColumns]}
                                onChange={(e) => updateVisibleColumns(key as keyof typeof visibleColumns, e.target.checked)}
                              />
                              <span>{label}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {!loading && !error && products.length > 0 && showFilters && (
          <div className="filters-panel">
            <div className="filters-header">
              <h3>Filter Products</h3>
              <button
                className="button button-secondary button-small"
                onClick={clearFilters}
                disabled={!filters.search && !filters.category && !filters.location && 
                         !filters.manufacturer && filters.priceMin === null && filters.priceMax === null}
              >
                Clear All
              </button>
            </div>
            
            <div className="filters-grid">
              <div className="filter-group">
                <label className="filter-label">Search</label>
                <input
                  type="text"
                  className="input filter-input"
                  placeholder="Search products..."
                  value={filters.search}
                  onChange={(e) => updateFilters('search', e.target.value)}
                />
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Category</label>
                <select
                  className="input filter-select"
                  value={filters.category}
                  onChange={(e) => updateFilters('category', e.target.value)}
                >
                  <option value="">All Categories</option>
                  {uniqueCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Location</label>
                <select
                  className="input filter-select"
                  value={filters.location}
                  onChange={(e) => updateFilters('location', e.target.value)}
                >
                  <option value="">All Locations</option>
                  {uniqueLocations.map(location => (
                    <option key={location} value={location}>{location}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Manufacturer</label>
                <select
                  className="input filter-select"
                  value={filters.manufacturer}
                  onChange={(e) => updateFilters('manufacturer', e.target.value)}
                >
                  <option value="">All Manufacturers</option>
                  {uniqueManufacturers.map(manufacturer => (
                    <option key={manufacturer} value={manufacturer}>{manufacturer}</option>
                  ))}
                </select>
              </div>
              
              <div className="filter-group">
                <label className="filter-label">Price Range</label>
                <div className="price-range">
                  <input
                    type="number"
                    className="input price-input"
                    placeholder="Min"
                    value={filters.priceMin || ''}
                    onChange={(e) => updateFilters('priceMin', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                  <span className="price-separator">to</span>
                  <input
                    type="number"
                    className="input price-input"
                    placeholder="Max"
                    value={filters.priceMax || ''}
                    onChange={(e) => updateFilters('priceMax', e.target.value ? parseFloat(e.target.value) : null)}
                  />
                </div>
              </div>
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
              onClick={() => navigate(`/projects/${projectId}/products/new`)}
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
                        {product.image ? (
                          <img src={product.image} alt={product.description} />
                        ) : (
                          <div className="no-image">No Image</div>
                        )}
                      </div>
                      <div className="product-info">
                        <h3 className="product-title">{product.product_name || product.description}</h3>
                        <p className="product-description">{product.description}</p>
                        {product.manufacturer && <p className="product-manufacturer">By: {product.manufacturer}</p>}
                        {product.price && <p className="product-price">{formatPrice(product.price)}</p>}
                        <p className="product-category">{product.category}</p>
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
                            onClick={() => navigate(`/projects/${projectId}/products/${product.id}`)}
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
                  <table>
                    <thead>
                      <tr>
                        {visibleColumns.image && <th>Image</th>}
                        {visibleColumns.productName && <th>Product Name</th>}
                        {visibleColumns.description && <th>Description</th>}
                        {visibleColumns.manufacturer && <th>Manufacturer</th>}
                        {visibleColumns.price && <th>Price</th>}
                        {visibleColumns.category && <th>Category</th>}
                        {visibleColumns.location && <th>Location</th>}
                        {visibleColumns.tagId && <th>Tag ID</th>}
                        {visibleColumns.actions && <th>Actions</th>}
                      </tr>
                    </thead>
                    <tbody>
                      {locationProducts.map(product => (
                        <tr key={product.id} className="table-row">
                          <td colSpan={Object.values(visibleColumns).filter(Boolean).length} className="row-wrapper">
                            <div className="row-scroll-container">
                              <div className="row-content">
                                {visibleColumns.image && (
                                  <div className="row-cell image-cell">
                                    <div className="list-product-image">
                                      {product.image ? (
                                        <img src={product.image} alt={product.description} />
                                      ) : (
                                        <div className="no-image-small">No Image</div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {visibleColumns.productName && (
                                  <div className="row-cell product-name-cell">
                                    <span className="product-name">{product.product_name || 'N/A'}</span>
                                  </div>
                                )}
                                {visibleColumns.description && (
                                  <div className="row-cell description-cell">
                                    <span className="product-description">{product.description}</span>
                                  </div>
                                )}
                                {visibleColumns.manufacturer && (
                                  <div className="row-cell manufacturer-cell">
                                    <span>{product.manufacturer || 'N/A'}</span>
                                  </div>
                                )}
                                {visibleColumns.price && (
                                  <div className="row-cell price-cell">
                                    <span>{formatPrice(product.price)}</span>
                                  </div>
                                )}
                                {visibleColumns.category && (
                                  <div className="row-cell category-cell">
                                    <span>{product.category}</span>
                                  </div>
                                )}
                                {visibleColumns.location && (
                                  <div className="row-cell location-cell">
                                    <div className="table-location-info">
                                      <span>{formatArray(product.location)}</span>
                                      {isMultiLocationProduct(product) && groupBy === 'location' && (
                                        <span className="multi-location-badge table-badge" title={`This product appears in ${getLocationCount(product)} locations`}>
                                          📍 {getLocationCount(product)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                )}
                                {visibleColumns.tagId && (
                                  <div className="row-cell tagid-cell">
                                    <span>{product.tagId}</span>
                                  </div>
                                )}
                                {visibleColumns.actions && (
                                  <div className="row-cell actions-cell">
                                    <div className="list-actions">
                                      <button
                                        className="product-link button-link"
                                        onClick={() => navigate(`/projects/${projectId}/products/${product.id}`)}
                                      >
                                        View
                                      </button>
                                      <a 
                                        href={product.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="product-link external-link"
                                      >
                                        Source
                                      </a>
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectPage;