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
import { mockProjects, mockProducts, getProductsByProject } from './mockData';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Custom API Error class
class ApiError extends Error {
  constructor(public message: string, public code: string) {
    super(message);
    this.name = 'ApiError';
  }
}

// Use generated mock data
const projects: Project[] = mockProjects;
const products: Product[] = mockProducts;

// Mock storage for locations
const mockLocations: string[] = [
  'Living Room',
  'Kitchen',
  'Bedroom',
  'Bathroom',
  'Office',
  'Garage',
  'Outdoor',
  'Basement',
  'Attic'
];

// Mock storage for categories
const mockCategories: string[] = [
  'Lighting',
  'Plumbing',
  'Electrical',
  'Flooring',
  'Windows & Doors',
  'HVAC',
  'Insulation',
  'Roofing',
  'Cabinets & Storage',
  'Countertops',
  'Fixtures & Hardware',
  'Building Materials',
  'Appliances',
  'Painting & Finishes'
];

export const fetchProductDetails = async (
  request: FetchProductDetailsRequest
): Promise<FetchProductDetailsResponse> => {
  // Simulate network delay
  await delay(800);
  
  // Random failure for testing (10% chance)
  if (Math.random() < 0.1) {
    throw new Error('API Error: Failed to fetch product details');
  }
  
  // Return mock data
  const randomId = Date.now();
  return {
    product_image: `https://picsum.photos/400/300?random=${randomId}`,
    product_images: [
      `https://picsum.photos/400/300?random=${randomId}`,
      `https://picsum.photos/400/300?random=${randomId + 1}`,
      `https://picsum.photos/400/300?random=${randomId + 2}`,
    ],
    product_description: `High-quality architectural product suitable for modern buildings. This product is designed for ${request.product_location} and offers excellent durability and aesthetic appeal.`,
    specification_description: `Dimensions: 24" x 36" x 2". Material: Stainless steel with powder coating. Weather resistant and suitable for ${request.product_location}. Tag ID: ${request.tag_id}`,
    category: [],
    product_name: `Premium ${mockCategories[Math.floor(Math.random() * mockCategories.length)]} Product`,
    manufacturer: ['Acme Corp', 'BuildPro', 'QualityFirst', 'TechBuilder', 'ModernDesign'][Math.floor(Math.random() * 5)],
    price: Math.floor(Math.random() * 500) + 50, // Random price between $50-$550
  };
};

export const saveProduct = async (
  request: SaveProductRequest
): Promise<{ success: boolean; productId: string }> => {
  // Simulate network delay
  await delay(600);
  
  // Random failure for testing (5% chance)
  if (Math.random() < 0.05) {
    throw new Error('API Error: Failed to save product');
  }
  
  // Mock successful save
  console.log('Saving product:', request);
  
  const productId = Date.now().toString();
  
  // Add to mock storage
  const newProduct: Product = {
    id: productId,
    projectId: request.project_id,
    url: request.product_url,
    tagId: request.tag_id,
    location: request.product_location, // Already an array
    image: request.product_image,
    images: request.product_images,
    description: request.product_description,
    specificationDescription: request.specification_description,
    category: request.category,
    product_name: request.product_name,
    manufacturer: request.manufacturer,
    price: request.price,
    custom_image_url: request.custom_image_url,
    createdAt: new Date(),
    updatedAt: new Date()
  };
  
  products.push(newProduct);
  
  // Update project product count - calculate actual count
  const project = projects.find(p => p.id === request.project_id);
  if (project) {
    project.productCount = products.filter(p => p.projectId === request.project_id).length;
    project.updatedAt = new Date();
  }
  
  return {
    success: true,
    productId,
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

// Add scraping endpoint
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
  await delay(2000); // Simulate longer scraping time
  
  // Simulate random success/failure
  if (Math.random() < 0.1) {
    return {
      success: false,
      error: 'Unable to extract product information from the provided URL'
    };
  }
  
  // Return mock scraped data
  const randomId = Date.now();
  return {
    success: true,
    data: {
      product_image: `https://picsum.photos/400/300?random=${randomId}`,
      product_images: [
        `https://picsum.photos/400/300?random=${randomId}`,
        `https://picsum.photos/400/300?random=${randomId + 1}`,
        `https://picsum.photos/400/300?random=${randomId + 2}`,
      ],
      product_description: `High-quality architectural product suitable for modern buildings. This product is designed for ${request.product_location} and offers excellent durability and aesthetic appeal.`,
      specification_description: `Dimensions: 24" x 36" x 2". Material: Stainless steel with powder coating. Weather resistant and suitable for ${request.product_location}. Tag ID: ${request.tag_id}`,
      category: [],
      product_name: `Premium ${mockCategories[Math.floor(Math.random() * mockCategories.length)]} Product`,
      manufacturer: [['Acme Corp', 'BuildPro', 'QualityFirst', 'TechBuilder', 'ModernDesign'][Math.floor(Math.random() * 5)]],
      price: Math.floor(Math.random() * 500) + 50, // Random price between $50-$550
    }
  };
};

// Standalone functions removed - use api.get() and api.post() instead

// Helper function to normalize endpoint path
const normalizeEndpoint = (endpoint: string): string => {
  // Remove /api prefix if present for internal routing
  return endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
};

// Standard API response format
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

// ErrorResponse interface removed - using ApiError class instead

// API object for organized endpoints
export const api = {
  get: async <T>(endpoint: string, params?: Record<string, any>): Promise<ApiResponse<T>> => {
    // Simulate network delay
    await delay(500);
    
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    
    // Parse query parameters
    const page = params?.page || 1;
    const limit = params?.limit || 20;
    const category = params?.category;
    const location = params?.location;
    
    try {
      // Handle different endpoints
      if (normalizedEndpoint === '/projects') {
        const offset = (page - 1) * limit;
        const paginatedProjects = projects.slice(offset, offset + limit);
        const total = projects.length;
        const pages = Math.ceil(total / limit);
        
        return {
          success: true,
          data: paginatedProjects as T,
          pagination: { page, limit, total, pages }
        };
      }
      
      if (normalizedEndpoint.includes('/projects/') && normalizedEndpoint.includes('/products')) {
        const projectId = normalizedEndpoint.split('/')[2];
        let projectProducts = getProductsByProject(projectId);
        
        // Apply filters
        if (category) {
          projectProducts = projectProducts.filter(p => 
            (typeof p.category === 'string' && p.category === category) ||
            (Array.isArray(p.category) && p.category.includes(category))
          );
        }
        
        if (location) {
          projectProducts = projectProducts.filter(p => 
            p.location.includes(location)
          );
        }
        
        // Apply pagination
        const offset = (page - 1) * limit;
        const paginatedProducts = projectProducts.slice(offset, offset + limit);
        const total = projectProducts.length;
        const pages = Math.ceil(total / limit);
        
        return {
          success: true,
          data: paginatedProducts as T,
          pagination: { page, limit, total, pages }
        };
      }
      
      if (normalizedEndpoint.includes('/projects/') && !normalizedEndpoint.includes('/products')) {
        const projectId = normalizedEndpoint.split('/')[2];
        const project = projects.find(p => p.id === projectId);
        if (!project) {
          throw new ApiError('Project not found', 'NOT_FOUND');
        }
        return { success: true, data: project as T };
      }
      
      if (normalizedEndpoint.includes('/products/')) {
        const productId = normalizedEndpoint.split('/')[2];
        const product = products.find(p => p.id === productId);
        if (!product) {
          throw new ApiError('Product not found', 'NOT_FOUND');
        }
        return { success: true, data: product as T };
      }
      
      if (normalizedEndpoint === '/locations') {
        const locations: Location[] = mockLocations.map((name, index) => ({
          id: (index + 1).toString(),
          name,
          createdAt: new Date('2024-01-01').toISOString()
        }));
        return {
          success: true,
          data: locations as T
        };
      }
      
      if (normalizedEndpoint === '/categories') {
        const categories: Category[] = mockCategories.map((name, index) => ({
          id: (index + 1).toString(),
          name,
          createdAt: new Date('2024-01-01').toISOString()
        }));
        return {
          success: true,
          data: categories as T
        };
      }
      
      throw new ApiError(`Unknown endpoint: ${endpoint}`, 'UNKNOWN_ENDPOINT');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal server error', 'INTERNAL_ERROR');
    }
  },
  
  post: async <T>(endpoint: string, data: any): Promise<ApiResponse<T>> => {
    await delay(300);
    
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    
    try {
      if (normalizedEndpoint === '/projects') {
        const newProject: Project = {
          id: `project-${Date.now()}`,
          name: data.name,
          description: data.description || '',
          status: data.status || 'planning',
          createdAt: new Date(),
          updatedAt: new Date(),
          productCount: 0
        };
        projects.push(newProject);
        return { success: true, data: newProject as T };
      }
      
      if (normalizedEndpoint === '/products') {
        const newProduct: Product = {
          id: `product-${Date.now()}`,
          projectId: data.project_id,
          url: data.product_url,
          tagId: data.tag_id,
          location: data.product_location,
          image: data.product_image,
          images: data.product_images,
          description: data.product_description,
          specificationDescription: data.specification_description,
          category: Array.isArray(data.category) ? data.category.join(', ') : data.category,
          product_name: data.product_name,
          manufacturer: Array.isArray(data.manufacturer) ? data.manufacturer[0] : data.manufacturer,
          price: data.price,
          custom_image_url: data.custom_image_url,
          createdAt: new Date(),
          updatedAt: new Date()
        };
        products.push(newProduct);
        
        // Update project product count - calculate actual count
        const project = projects.find(p => p.id === data.project_id);
        if (project) {
          project.productCount = products.filter(p => p.projectId === data.project_id).length;
          project.updatedAt = new Date();
        }
        
        return { success: true, data: newProduct as T };
      }
      
      if (normalizedEndpoint === '/locations') {
        const request = data as AddLocationRequest;
        if (!mockLocations.includes(request.name)) {
          mockLocations.push(request.name);
        }
        const location: Location = {
          id: mockLocations.length.toString(),
          name: request.name,
          createdAt: new Date().toISOString()
        };
        return { success: true, data: location as T };
      }
      
      if (normalizedEndpoint === '/categories') {
        const request = data as AddCategoryRequest;
        if (!mockCategories.includes(request.name)) {
          mockCategories.push(request.name);
        }
        const category: Category = {
          id: mockCategories.length.toString(),
          name: request.name,
          createdAt: new Date().toISOString()
        };
        return { success: true, data: category as T };
      }
      
      throw new ApiError(`Unknown POST endpoint: ${endpoint}`, 'UNKNOWN_ENDPOINT');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal server error', 'INTERNAL_ERROR');
    }
  },
  
  put: async <T>(endpoint: string, data: any): Promise<ApiResponse<T>> => {
    await delay(300);
    
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    
    try {
      if (normalizedEndpoint.includes('/projects/')) {
        const projectId = normalizedEndpoint.split('/')[2];
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) {
          throw new ApiError('Project not found', 'NOT_FOUND');
        }
        
        projects[projectIndex] = {
          ...projects[projectIndex],
          ...data,
          updatedAt: new Date()
        };
        return { success: true, data: projects[projectIndex] as T };
      }
      
      if (normalizedEndpoint.includes('/products/')) {
        const productId = normalizedEndpoint.split('/')[2];
        const productIndex = products.findIndex(p => p.id === productId);
        if (productIndex === -1) {
          throw new ApiError('Product not found', 'NOT_FOUND');
        }
        
        products[productIndex] = {
          ...products[productIndex],
          ...data,
          updatedAt: new Date()
        };
        return { success: true, data: products[productIndex] as T };
      }
      
      throw new ApiError(`Unknown PUT endpoint: ${endpoint}`, 'UNKNOWN_ENDPOINT');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal server error', 'INTERNAL_ERROR');
    }
  },
  
  delete: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
    await delay(300);
    
    const normalizedEndpoint = normalizeEndpoint(endpoint);
    
    try {
      if (normalizedEndpoint.includes('/projects/')) {
        const projectId = normalizedEndpoint.split('/')[2];
        const projectIndex = projects.findIndex(p => p.id === projectId);
        if (projectIndex === -1) {
          throw new ApiError('Project not found', 'NOT_FOUND');
        }
        
        const deletedProject = projects.splice(projectIndex, 1)[0];
        // Also remove all products for this project
        const productIndices = products
          .map((p, i) => p.projectId === projectId ? i : -1)
          .filter(i => i !== -1)
          .reverse(); // Reverse to delete from end to avoid index issues
        
        productIndices.forEach(i => products.splice(i, 1));
        
        return { success: true, data: deletedProject as T };
      }
      
      if (normalizedEndpoint.includes('/products/')) {
        const productId = normalizedEndpoint.split('/')[2];
        const productIndex = products.findIndex(p => p.id === productId);
        if (productIndex === -1) {
          throw new ApiError('Product not found', 'NOT_FOUND');
        }
        
        const deletedProduct = products.splice(productIndex, 1)[0];
        
        // Update project product count - calculate actual count
        const project = projects.find(p => p.id === deletedProduct.projectId);
        if (project) {
          project.productCount = products.filter(p => p.projectId === deletedProduct.projectId).length;
          project.updatedAt = new Date();
        }
        
        return { success: true, data: deletedProduct as T };
      }
      
      throw new ApiError(`Unknown DELETE endpoint: ${endpoint}`, 'UNKNOWN_ENDPOINT');
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Internal server error', 'INTERNAL_ERROR');
    }
  },

  // Add scraping endpoint to main API object
  scrape: async (request: {
    url: string;
    tag_id: string;
    product_location: string;
  }) => {
    await delay(2000); // Simulate longer scraping time
    
    try {
      // Simulate random success/failure
      if (Math.random() < 0.1) {
        throw new ApiError('Unable to extract product information from the provided URL', 'SCRAPING_FAILED');
      }
      
      // Return mock scraped data
      const randomId = Date.now();
      return {
        success: true,
        data: {
          product_image: `https://picsum.photos/400/300?random=${randomId}`,
          product_images: [
            `https://picsum.photos/400/300?random=${randomId}`,
            `https://picsum.photos/400/300?random=${randomId + 1}`,
            `https://picsum.photos/400/300?random=${randomId + 2}`,
          ],
          product_description: `High-quality architectural product suitable for modern buildings. This product is designed for ${request.product_location} and offers excellent durability and aesthetic appeal.`,
          specification_description: `Dimensions: 24" x 36" x 2". Material: Stainless steel with powder coating. Weather resistant and suitable for ${request.product_location}. Tag ID: ${request.tag_id}`,
          category: [],
          product_name: `Premium ${mockCategories[Math.floor(Math.random() * mockCategories.length)]} Product`,
          manufacturer: [['Acme Corp', 'BuildPro', 'QualityFirst', 'TechBuilder', 'ModernDesign'][Math.floor(Math.random() * 5)]],
          price: Math.floor(Math.random() * 500) + 50, // Random price between $50-$550
        }
      };
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      throw new ApiError('Scraping failed', 'SCRAPING_ERROR');
    }
  }
};