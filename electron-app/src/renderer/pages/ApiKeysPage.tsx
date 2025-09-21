import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../hooks/useToast';
import './ApiKeysPage.css';

const ApiKeysPage: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [openaiKey, setOpenaiKey] = useState('');
  const [firecrawlKey, setFirecrawlKey] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!openaiKey.trim() || !firecrawlKey.trim()) {
      showToast('Please enter both API keys', 'error');
      return;
    }

    setIsSubmitting(true);
    
    try {
      // Call the IPC method to set the API keys
      await window.electronAPI.setApiKeys({
        openai: openaiKey.trim(),
        firecrawl: firecrawlKey.trim()
      });
      
      showToast('API keys have been set successfully', 'success');
      
      // Navigate back to the previous page
      navigate(-1);
    } catch (error) {
      console.error('Failed to set API keys:', error);
      showToast('Failed to set API keys. Please try again.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    // Navigate back to the previous page
    navigate(-1);
  };

  return (
    <div className="page-container">
      <div className="api-keys-page">
        <div className="page-header">
          <h1>API Keys Configuration</h1>
          <p className="page-description">
            Enter your API keys to enable web scraping functionality. These keys will be stored for the current session only.
          </p>
        </div>

        <div className="api-keys-form-container">
          <form onSubmit={handleSubmit} className="api-keys-form">
            <div className="form-group">
              <label htmlFor="openaiKey" className="form-label">
                OpenAI API Key
              </label>
              <input
                type="password"
                id="openaiKey"
                value={openaiKey}
                onChange={(e) => setOpenaiKey(e.target.value)}
                placeholder="sk-..."
                className="form-input"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="firecrawlKey" className="form-label">
                Firecrawl API Key
              </label>
              <input
                type="password"
                id="firecrawlKey"
                value={firecrawlKey}
                onChange={(e) => setFirecrawlKey(e.target.value)}
                placeholder="fc-..."
                className="form-input"
                autoComplete="off"
                disabled={isSubmitting}
              />
            </div>

            <div className="form-actions">
              <button
                type="button"
                onClick={handleCancel}
                className="button button-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button button-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Setting Keys...' : 'Set API Keys'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ApiKeysPage;
