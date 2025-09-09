/**
 * IPC-based API service that replaces the HTTP mock API
 * Maintains exact same interface for zero-breaking-change migration
 */

// Re-export types from existing API for compatibility
import {
  FetchProductDetailsRequest,
  FetchProductDetailsResponse,
  SaveProductRequest,
  Product,
  Project,
  Location,
  Category,
  AddLocationRequest,
  AddCategoryRequest
} from '../types';

// Custom API Error class (same as original)
class ApiError extends Error {
  constructor(public message: string, public code: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Standard API response format (same as original)
interface ApiResponse<T> {
  success: boolean;
  data: T;
  pagination?: PaginationInfo;
}

interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  pages: number;
}

/**
 * Legacy functions - maintained for compatibility
 */
export const fetchProductDetails = async (
  request: FetchProductDetailsRequest
): Promise<FetchProductDetailsResponse> => {
  // This function isn't used in current codebase but maintained for compatibility
  throw new Error('fetchProductDetails is deprecated, use api.scrape() instead');
};

export const saveProduct = async (
  request: SaveProductRequest
): Promise<{ success: boolean; productId: string }> => {
  // This function isn't used in current codebase but maintained for compatibility
  const result = await api.post('/api/products', request);
  if (!result.success) {
    throw new Error(result.error || 'Failed to save product');
  }
  return {
    success: true,
    productId: result.data.id
  };
};

export const handleApiError = (error: unknown): { message: string; code: string } => {
  if (error instanceof ApiError) {
    return {
      message: error.message,
      code: error.code
    };
  }
  
  if (error instanceof Error) {
    return {
      message: error.message,
      code: 'UNKNOWN_ERROR'
    };
  }
  
  return {
    message: 'An unexpected error occurred',
    code: 'UNKNOWN_ERROR'
  };
};

/**
 * Scraping function - maintained for compatibility
 */
export const scrapeProduct = async (request: {
  url: string;
  tag_id: string;
  product_location: string;
}): Promise<{ 
  success: boolean; 
  data?: {
    product_image: string;
    product_images: string[];
    product_description: string;
    specification_description: string;
    category: string[];
    product_name: string;
    manufacturer: string[];
    price: number;
  };
  error?: string;
}> => {
  if (!window.electronAPI) {
    return {
      success: false,
      error: 'Electron API not available'
    };
  }

  try {
    return await window.electronAPI.apiScrape(request);
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Scraping failed'
    };
  }
};

/**
 * Main API object - replaces HTTP calls with IPC calls
 * Maintains exact same interface as original API service
 */
export const api = {
  get: async <T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> => {
    if (!window.electronAPI) {
      throw new ApiError('Electron API not available', 'ELECTRON_UNAVAILABLE');
    }

    try {
      const result = await window.electronAPI.apiGet(endpoint, params);
      
      if (!result.success) {
        throw new ApiError(result.error || 'Request failed', 'API_ERROR');
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal client error', 'INTERNAL_ERROR');
    }
  },
  
  post: async <T>(endpoint: string, data?: any): Promise<ApiResponse<T>> => {
    if (!window.electronAPI) {
      throw new ApiError('Electron API not available', 'ELECTRON_UNAVAILABLE');
    }

    try {
      const result = await window.electronAPI.apiPost(endpoint, data);
      
      if (!result.success) {
        throw new ApiError(result.error || 'Request failed', 'API_ERROR');
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal client error', 'INTERNAL_ERROR');
    }
  },
  
  put: async <T>(endpoint: string, data?: any): Promise<ApiResponse<T>> => {
    if (!window.electronAPI) {
      throw new ApiError('Electron API not available', 'ELECTRON_UNAVAILABLE');
    }

    try {
      const result = await window.electronAPI.apiPut(endpoint, data);
      
      if (!result.success) {
        throw new ApiError(result.error || 'Request failed', 'API_ERROR');
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal client error', 'INTERNAL_ERROR');
    }
  },
  
  delete: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    if (!window.electronAPI) {
      throw new ApiError('Electron API not available', 'ELECTRON_UNAVAILABLE');
    }

    try {
      const result = await window.electronAPI.apiDelete(endpoint);
      
      if (!result.success) {
        throw new ApiError(result.error || 'Request failed', 'API_ERROR');
      }

      return result;
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal client error', 'INTERNAL_ERROR');
    }
  },

  // Scraping endpoint maintained for compatibility
  scrape: async (request: {
    url: string;
    tag_id: string;
    product_location: string;
  }) => {
    return await scrapeProduct(request);
  }
};

// Export everything for compatibility
export { ApiError, ApiResponse, PaginationInfo };