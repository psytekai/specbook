import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useProjects } from '../hooks/useProjects';
import { Product } from '../types';
import { api } from '../services/api';
import './ProductPage.css';

const ProductPage: React.FC = () => {
  const { projectId, productId } = useParams<{ projectId: string; productId: string }>();
  const navigate = useNavigate();
  const { projects } = useProjects();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
            <h1>{product.description}</h1>
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
            {product.image ? (
              <div className="main-image">
                <img src={product.image} alt={product.description} />
              </div>
            ) : (
              <div className="no-image-large">
                <p>No Image Available</p>
              </div>
            )}
            
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
              <div className="detail-grid">
                <div className="detail-item">
                  <label>Category:</label>
                  <span>{product.category || 'Not specified'}</span>
                </div>
                <div className="detail-item">
                  <label>Location:</label>
                  <span>{product.location}</span>
                </div>
                <div className="detail-item">
                  <label>Tag ID:</label>
                  <span>{product.tagId}</span>
                </div>
                <div className="detail-item">
                  <label>Added:</label>
                  <span>{new Date(product.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {product.description && (
              <div className="detail-section">
                <h2>Description</h2>
                <p className="description-text">{product.description}</p>
              </div>
            )}

            {product.specificationDescription && (
              <div className="detail-section">
                <h2>Specifications</h2>
                <p className="specification-text">{product.specificationDescription}</p>
              </div>
            )}

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