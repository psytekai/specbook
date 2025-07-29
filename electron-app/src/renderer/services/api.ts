import {
  FetchProductDetailsRequest,
  FetchProductDetailsResponse,
  SaveProductRequest,
  ApiError,
  Product
} from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Mock storage for products
const mockProducts: Product[] = [];

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
    category: 'Building Materials',
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
    location: request.product_location,
    image: request.product_image,
    images: request.product_images,
    description: request.product_description,
    specificationDescription: request.specification_description,
    category: request.category,
    createdAt: new Date()
  };
  
  mockProducts.push(newProduct);
  
  return {
    success: true,
    productId,
  };
};

export const handleApiError = (error: unknown): ApiError => {
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

export const fetchProductLocations = async (): Promise<string[]> => {
  // Simulate network delay
  await delay(300);
  
  // Return mock locations
  return [...mockLocations];
};

export const addProductLocation = async (location: string): Promise<{ success: boolean }> => {
  // Simulate network delay
  await delay(200);
  
  // Add to mock storage if not already exists
  if (!mockLocations.includes(location)) {
    mockLocations.push(location);
  }
  
  return { success: true };
};

// API object for organized endpoints
export const api = {
  get: async <T>(endpoint: string): Promise<{ data: T }> => {
    // Simulate network delay
    await delay(500);
    
    // Handle different endpoints
    if (endpoint.includes('/projects/') && endpoint.includes('/products')) {
      const projectId = endpoint.split('/')[2];
      const products = mockProducts.filter(p => p.projectId === projectId);
      return { data: products as T };
    }
    
    throw new Error(`Unknown endpoint: ${endpoint}`);
  }
};