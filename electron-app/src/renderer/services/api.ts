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
    category: [mockCategories[Math.floor(Math.random() * mockCategories.length)]],
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

export const fetchProductCategories = async (): Promise<string[]> => {
  // Simulate network delay
  await delay(300);
  
  // Return mock categories
  return [...mockCategories];
};

export const addProductCategory = async (category: string): Promise<{ success: boolean }> => {
  // Simulate network delay
  await delay(200);
  
  // Add to mock storage if not already exists
  if (!mockCategories.includes(category)) {
    mockCategories.push(category);
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