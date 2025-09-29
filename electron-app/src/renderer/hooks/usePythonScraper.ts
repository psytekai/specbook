import { useState, useEffect, useCallback } from 'react';
import type { ScrapeProgress, ScrapeResult, ScrapeOptions, PythonStatus, StructuredLogEvent } from '../../shared/types';

export function usePythonScraper() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [pythonStatus, setPythonStatus] = useState<PythonStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<ScrapeProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Check Python availability on mount
  useEffect(() => {
    checkAvailability();
    
    // Set up progress listener with cleanup
    if (!window.electronAPI) return;
    
    const cleanup = window.electronAPI.onScrapeProgress((progress: ScrapeProgress) => {
      setProgress(progress);
    });
    
    return cleanup; // Cleanup function returned from preload
  }, []);
  
  /**
   * Check Python bridge availability
   */
  const checkAvailability = async () => {
    if (!window.electronAPI) {
      setIsAvailable(false);
      setError('Electron API not available');
      return;
    }

    try {
      const status = await window.electronAPI.checkPythonAvailability();
      setPythonStatus(status);
      setIsAvailable(status.available);
      
      if (!status.available && status.error) {
        setError(status.error);
      } else {
        setError(null);
      }
    } catch (err) {
      console.error('Failed to check Python availability:', err);
      setIsAvailable(false);
      setError('Failed to check Python availability');
    }
  };
  
  /**
   * Get current Python status
   */
  const getStatus = async (): Promise<PythonStatus | null> => {
    if (!window.electronAPI) {
      return null;
    }

    try {
      const status = await window.electronAPI.getPythonStatus();
      setPythonStatus(status);
      return status;
    } catch (err) {
      console.error('Failed to get Python status:', err);
      return null;
    }
  };
  
  /**
   * Scrape a product URL using the Python bridge
   */
  const scrapeProduct = useCallback(async (
    url: string,
    options?: ScrapeOptions
  ): Promise<ScrapeResult | null> => {
    if (!window.electronAPI) {
      setError('Electron API not available');
      return null;
    }

    if (!isAvailable) {
      setError('Python scraper not available');
      return null;
    }
    
    // Validate URL
    if (!url || typeof url !== 'string') {
      setError('Invalid URL provided');
      return null;
    }

    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      setError('URL must start with http:// or https://');
      return null;
    }
    
    setIsLoading(true);
    setError(null);
    setProgress(null);
    
    try {
      const result = await window.electronAPI.scrapeProduct(url, options);
      
      if (!result.success) {
        setError(result.error || 'Scraping failed');
      }
      
      return result;
    } catch (err) {
      console.error('Scraping error:', err);
      const errorMsg = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMsg);
      return null;
    } finally {
      setIsLoading(false);
      // Keep progress visible briefly after completion
      setTimeout(() => {
        setProgress(null);
      }, 2000);
    }
  }, [isAvailable]);
  
  /**
   * Reset error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);
  
  /**
   * Reset progress state
   */
  const clearProgress = useCallback(() => {
    setProgress(null);
  }, []);
  
  return {
    // Status
    isAvailable,
    pythonStatus,
    isLoading,
    progress,
    error,
    
    // Actions
    scrapeProduct,
    checkAvailability,
    getStatus,
    clearError,
    clearProgress
  };
}

export type { ScrapeProgress, ScrapeResult, ScrapeOptions, PythonStatus, StructuredLogEvent };