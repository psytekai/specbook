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
        ) : (
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
        )}
      </div>
    </div>
  );
};

export default ProjectPage;