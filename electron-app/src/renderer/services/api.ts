import {
  FetchProductDetailsRequest,
  FetchProductDetailsResponse,
  SaveProductRequest,
  ApiError
} from '../types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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
  
  return {
    success: true,
    productId: Date.now().toString(),
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