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
  location: string;
  image: string;
  images: string[];
  description: string;
  specificationDescription: string;
  category: string;
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
  category: string;
}

export interface SaveProductRequest extends FetchProductDetailsRequest {
  product_image: string;
  product_images: string[];
  product_description: string;
  specification_description: string;
  category: string;
  project_id: string;
}

export type ToastType = 'error' | 'success' | 'info';

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
  duration?: number;
}