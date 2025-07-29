import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { Product } from '../types';
import { api } from '../services/api';
import './ProjectPage.css';

const ProjectPage: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list');

  const project = projects.find(p => p.id === projectId);

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
          <div className="view-toggle">
            <button
              className={`toggle-button ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
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
              onClick={() => setViewMode('list')}
              title="List view"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor">
                <rect x="3" y="4" width="14" height="2" strokeWidth="2"/>
                <rect x="3" y="9" width="14" height="2" strokeWidth="2"/>
                <rect x="3" y="14" width="14" height="2" strokeWidth="2"/>
              </svg>
            </button>
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
          <div className="products-grid">
            {products.map(product => (
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
                  <a 
                    href={product.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="product-link"
                  >
                    View Product →
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
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
                {products.map(product => (
                  <tr key={product.id}>
                    <td>
                      <div className="list-product-image">
                        {product.image ? (
                          <img src={product.image} alt={product.description} />
                        ) : (
                          <div className="no-image-small">No Image</div>
                        )}
                      </div>
                    </td>
                    <td className="product-description">{product.description}</td>
                    <td>{product.category}</td>
                    <td>{product.location}</td>
                    <td>{product.tagId}</td>
                    <td>
                      <a 
                        href={product.url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="product-link"
                      >
                        View →
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectPage;