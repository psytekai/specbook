export interface Project {
  id: string;
  name: string;
  productCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Product {
  id: string;
  projectId: string;
  url: string;
  tagId: string;
  location: string[];           // CHANGED: multi-select
  image: string;
  images: string[];
  description: string;
  specificationDescription: string;
  category: string[];           // CHANGED: multi-select
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW  
  price?: number;              // NEW
  custom_image_url?: string;   // NEW
  createdAt: Date;
}

export interface ApiError {
  message: string;
  code: string;
}

export interface FetchProductDetailsRequest {
  product_url: string;
  tag_id: string;
  product_location: string;
}

export interface FetchProductDetailsResponse {
  product_image: string;
  product_images: string[];
  product_description: string;
  specification_description: string;
  category: string[];
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW
  price?: number;              // NEW
}

export interface SaveProductRequest {
  product_url: string;
  tag_id: string;
  product_location: string[];   // CHANGED: multi-select
  product_image: string;
  product_images: string[];
  product_description: string;
  specification_description: string;
  category: string[];
  product_name?: string;        // NEW
  manufacturer?: string;        // NEW
  price?: number;              // NEW
  custom_image_url?: string;   // NEW
  project_id: string;
}

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}