import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { Product } from '../types';
import { api } from '../services/api';
import './ProjectPage.css';

// Types for persisted state
interface ProjectPageState {
  viewMode: 'grid' | 'list';
  groupBy: 'none' | 'location';
  sortBy: 'name' | 'date' | 'location';
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
    
    if (parsed.groupBy === 'none' || parsed.groupBy === 'location') {
      validatedState.groupBy = parsed.groupBy;
    }
    
    if (parsed.sortBy === 'name' || parsed.sortBy === 'date' || parsed.sortBy === 'location') {
      validatedState.sortBy = parsed.sortBy;
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

  // Initialize state from localStorage with fallback defaults
  const storedState = getStoredState();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(storedState.viewMode || 'list');
  const [groupBy, setGroupBy] = useState<'none' | 'location'>(storedState.groupBy || 'none');
  const [sortBy, setSortBy] = useState<'name' | 'date' | 'location'>(storedState.sortBy || 'date');

  const project = projects.find(p => p.id === projectId);

  // State update functions that persist to localStorage
  const updateViewMode = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    if (isInitialized) {
      saveState({ viewMode: mode });
    }
  };

  const updateGroupBy = (group: 'none' | 'location') => {
    setGroupBy(group);
    if (isInitialized) {
      saveState({ groupBy: group });
    }
  };

  const updateSortBy = (sort: 'name' | 'date' | 'location') => {
    setSortBy(sort);
    if (isInitialized) {
      saveState({ sortBy: sort });
    }
  };

  // Helper function to sort products
  const sortProducts = (products: Product[]) => {
    return [...products].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.description.localeCompare(b.description);
        case 'location':
          return a.location.localeCompare(b.location);
        case 'date':
        default:
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });
  };

  // Helper function to group products by location
  const groupProductsByLocation = (products: Product[]) => {
    const sorted = sortProducts(products);
    const grouped = sorted.reduce((acc, product) => {
      const location = product.location || 'Unspecified';
      if (!acc[location]) {
        acc[location] = [];
      }
      acc[location].push(product);
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

  // Get organized products based on current settings
  const organizedProducts = groupBy === 'location' 
    ? groupProductsByLocation(products)
    : { 'All Products': sortProducts(products) };

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
                  onChange={(e) => updateGroupBy(e.target.value as 'none' | 'location')}
                >
                  <option value="none">None</option>
                  <option value="location">Location</option>
                </select>
              </div>
              
              <div className="control-group">
                <label className="control-label">Sort by:</label>
                <select
                  className="control-select"
                  value={sortBy}
                  onChange={(e) => updateSortBy(e.target.value as 'name' | 'date' | 'location')}
                >
                  <option value="date">Date Added</option>
                  <option value="name">Name</option>
                  <option value="location">Location</option>
                </select>
              </div>
            </div>

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
                    <span className="group-count">({locationProducts.length} products)</span>
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
                        <h3 className="product-title">{product.description}</h3>
                        <p className="product-category">{product.category}</p>
                        <p className="product-location">{product.location}</p>
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
                    <span className="group-count">({locationProducts.length} products)</span>
                  </div>
                )}
                <div className="products-list">
                  <table>
                    <thead>
                      <tr>
                        <th>Image</th>
                        <th>Description</th>
                        <th>Category</th>
                        <th>Location</th>
                        <th>Tag ID</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {locationProducts.map(product => (
                        <tr key={product.id} className="table-row">
                          <td colSpan={6} className="row-wrapper">
                            <div className="row-scroll-container">
                              <div className="row-content">
                                <div className="row-cell image-cell">
                                  <div className="list-product-image">
                                    {product.image ? (
                                      <img src={product.image} alt={product.description} />
                                    ) : (
                                      <div className="no-image-small">No Image</div>
                                    )}
                                  </div>
                                </div>
                                <div className="row-cell description-cell">
                                  <span className="product-description">{product.description}</span>
                                </div>
                                <div className="row-cell category-cell">
                                  <span>{product.category}</span>
                                </div>
                                <div className="row-cell location-cell">
                                  <span>{product.location}</span>
                                </div>
                                <div className="row-cell tagid-cell">
                                  <span>{product.tagId}</span>
                                </div>
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