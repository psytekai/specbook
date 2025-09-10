import { ipcMain } from 'electron';
import { ProjectState } from '../services/ProjectState';

/**
 * Set up IPC handlers that replace the existing API service
 * Maintains exact same interfaces for frontend compatibility
 */
/**
 * API Router - handles endpoint routing similar to existing API service
 */
class APIRouter {
  private projectState = ProjectState.getInstance();

  async routeGet(endpoint: string, params: any = {}) {
    // Normalize endpoint by removing /api prefix
    const normalizedEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
    
    try {
      if (normalizedEndpoint === '/projects') {
        return await this.getProjects(params);
      }
      
      if (normalizedEndpoint.match(/^\/projects\/([^/]+)$/)) {
        const projectId = normalizedEndpoint.split('/')[2];
        return await this.getProject(projectId);
      }
      
      if (normalizedEndpoint.match(/^\/projects\/([^/]+)\/products$/)) {
        const projectId = normalizedEndpoint.split('/')[2];
        return await this.getProducts(projectId, params);
      }
      
      if (normalizedEndpoint.match(/^\/products\/([^/]+)$/)) {
        const productId = normalizedEndpoint.split('/')[2];
        return await this.getProduct(productId);
      }
      
      if (normalizedEndpoint === '/locations') {
        return await this.getLocations();
      }
      
      if (normalizedEndpoint === '/categories') {
        return await this.getCategories();
      }
      
      throw new Error(`Unknown GET endpoint: ${endpoint}`);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async routePost(endpoint: string, data: any = {}) {
    const normalizedEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
    
    try {
      if (normalizedEndpoint === '/projects') {
        return await this.createProject(data);
      }
      
      if (normalizedEndpoint === '/products') {
        return await this.createProduct(data);
      }
      
      if (normalizedEndpoint === '/locations') {
        return await this.createLocation(data);
      }
      
      if (normalizedEndpoint === '/categories') {
        return await this.createCategory(data);
      }
      
      throw new Error(`Unknown POST endpoint: ${endpoint}`);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async routePut(endpoint: string, data: any = {}) {
    const normalizedEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
    
    try {
      if (normalizedEndpoint.match(/^\/projects\/([^/]+)$/)) {
        const projectId = normalizedEndpoint.split('/')[2];
        return await this.updateProject(projectId, data);
      }
      
      if (normalizedEndpoint.match(/^\/products\/([^/]+)$/)) {
        const productId = normalizedEndpoint.split('/')[2];
        return await this.updateProduct(productId, data);
      }
      
      throw new Error(`Unknown PUT endpoint: ${endpoint}`);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async routeDelete(endpoint: string) {
    const normalizedEndpoint = endpoint.startsWith('/api') ? endpoint.slice(4) : endpoint;
    
    try {
      if (normalizedEndpoint.match(/^\/projects\/([^/]+)$/)) {
        const projectId = normalizedEndpoint.split('/')[2];
        return await this.deleteProject(projectId);
      }
      
      if (normalizedEndpoint.match(/^\/products\/([^/]+)$/)) {
        const productId = normalizedEndpoint.split('/')[2];
        return await this.deleteProduct(productId);
      }
      
      throw new Error(`Unknown DELETE endpoint: ${endpoint}`);
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Implementation methods
  private async getProjects(params: any) {
    const state = this.projectState.getStateInfo();
    
    if (!state.isOpen || !state.project) {
      return {
        success: true,
        data: [],
        pagination: {
          page: params.page || 1,
          limit: params.limit || 20,
          total: 0,
          pages: 0
        }
      };
    }

    const projects = [{
      id: 'current',
      name: state.project.name || 'Untitled Project',
      description: state.project.description || '',
      status: 'active',
      productCount: 0, // TODO: Calculate from database
      createdAt: state.project.createdAt || new Date(),
      updatedAt: state.project.updatedAt || new Date()
    }];

    const page = params.page || 1;
    const limit = params.limit || 20;
    const total = projects.length;
    const pages = Math.ceil(total / limit);

    return {
      success: true,
      data: projects,
      pagination: { page, limit, total, pages }
    };
  }

  private async getProject(projectId: string) {
    const state = this.projectState.getStateInfo();
    
    if (!state.isOpen || !state.project || projectId !== 'current') {
      throw new Error('Project not found');
    }

    const project = {
      id: 'current',
      name: state.project.name || 'Untitled Project',
      description: state.project.description || '',
      status: 'active',
      productCount: 0, // TODO: Calculate from database
      createdAt: state.project.createdAt || new Date(),
      updatedAt: state.project.updatedAt || new Date()
    };

    return { success: true, data: project };
  }

  private async getProducts(_projectId: string, params: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      return {
        success: true,
        data: [],
        pagination: {
          page: params.page || 1,
          limit: params.limit || 20,
          total: 0,
          pages: 0
        }
      };
    }

    const products = await manager.getProducts({
      category: params.category,
      location: params.location
    });

    // Apply pagination
    const page = params.page || 1;
    const limit = params.limit || 20;
    const offset = (page - 1) * limit;
    const paginatedData = products.slice(offset, offset + limit);

    return {
      success: true,
      data: paginatedData,
      pagination: {
        page,
        limit,
        total: products.length,
        pages: Math.ceil(products.length / limit)
      }
    };
  }

  private async getProduct(productId: string) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    // For now, get all products and find the one we need
    // TODO: Add getProduct method to ProjectFileManager
    const products = await manager.getProducts();
    const product = products.find(p => p.id === productId);
    
    if (!product) {
      throw new Error('Product not found');
    }

    return { success: true, data: product };
  }

  private async createProject(_data: any) {
    // Project creation is handled by File menu
    throw new Error('Use File > New Project instead');
  }

  private async updateProject(projectId: string, data: any) {
    // For now, project updates don't need file system changes
    // The project name/metadata is managed by ProjectState
    return { success: true, data: { id: projectId, ...data } };
  }

  private async deleteProject(_projectId: string) {
    // Project deletion is handled by File menu
    throw new Error('Use File > Close Project instead');
  }

  private async createProduct(data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    const product = await manager.createProduct({
      projectId: 'current',
      url: data.product_url,
      tagId: data.tag_id,
      location: data.product_location,
      image: data.product_image,
      images: data.product_images,
      description: data.product_description,
      specificationDescription: data.specification_description,
      category: data.category,
      product_name: data.product_name,
      manufacturer: data.manufacturer,
      price: data.price,
      custom_image_url: data.custom_image_url,
      // Asset hash fields for content-addressable storage
      imageHash: data.image_hash,
      thumbnailHash: data.thumbnail_hash,
      imagesHashes: data.images_hashes
    });

    this.projectState.markDirty();
    return { success: true, data: product };
  }

  private async updateProduct(productId: string, data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    // Map API field names to internal field names, including asset hash fields
    const fieldMapping: Record<string, string> = {
      product_url: 'url',
      tag_id: 'tagId',
      product_location: 'location',
      product_image: 'image',
      product_images: 'images',
      product_description: 'description',
      specification_description: 'specificationDescription',
      image_hash: 'imageHash',
      thumbnail_hash: 'thumbnailHash',
      images_hashes: 'imagesHashes'
    };

    const updateData: Record<string, any> = {};
    
    // Map fields that need name conversion
    for (const [apiField, dbField] of Object.entries(fieldMapping)) {
      if (data[apiField] !== undefined) {
        updateData[dbField] = data[apiField];
      }
    }

    // Add fields that don't need mapping
    const directFields = ['category', 'product_name', 'manufacturer', 'price', 'custom_image_url'];
    for (const field of directFields) {
      if (data[field] !== undefined) {
        updateData[field] = data[field];
      }
    }

    const product = await manager.updateProduct(productId, updateData);

    this.projectState.markDirty();
    return { success: true, data: product };
  }

  private async deleteProduct(productId: string) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    const deleted = await manager.deleteProduct(productId);
    
    if (!deleted) {
      throw new Error('Failed to delete product');
    }

    this.projectState.markDirty();
    return { success: true, data: { id: productId } };
  }

  private async getLocations() {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      // Return default locations
      const defaultLocations = [
        'Living Room', 'Kitchen', 'Bedroom', 'Bathroom', 
        'Office', 'Garage', 'Outdoor', 'Basement', 'Attic'
      ].map((name, index) => ({
        id: (index + 1).toString(),
        name,
        createdAt: new Date('2024-01-01').toISOString()
      }));

      return { success: true, data: defaultLocations };
    }

    const locations = await manager.getLocations();
    return { success: true, data: locations };
  }

  private async createLocation(data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    // For now, we don't have createLocation method in ProjectFileManager
    // Just return a mock location
    const location = {
      id: Date.now().toString(),
      name: data.name,
      createdAt: new Date().toISOString()
    };

    this.projectState.markDirty();
    return { success: true, data: location };
  }

  private async getCategories() {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      // Return default categories
      const defaultCategories = [
        'Lighting', 'Plumbing', 'Electrical', 'Flooring', 'Windows & Doors',
        'HVAC', 'Insulation', 'Roofing', 'Cabinets & Storage', 'Countertops',
        'Fixtures & Hardware', 'Building Materials', 'Appliances', 'Painting & Finishes'
      ].map((name, index) => ({
        id: (index + 1).toString(),
        name,
        createdAt: new Date('2024-01-01').toISOString()
      }));

      return { success: true, data: defaultCategories };
    }

    const categories = await manager.getCategories();
    return { success: true, data: categories };
  }

  private async createCategory(data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    // For now, we don't have createCategory method in ProjectFileManager
    // Just return a mock category
    const category = {
      id: Date.now().toString(),
      name: data.name,
      createdAt: new Date().toISOString()
    };

    this.projectState.markDirty();
    return { success: true, data: category };
  }
}

export function setupAPIIPC(): void {
  const router = new APIRouter();

  /**
   * Main API router handlers
   */
  ipcMain.handle('api:get', async (_event, endpoint: string, params?: any) => {
    return await router.routeGet(endpoint, params);
  });

  ipcMain.handle('api:post', async (_event, endpoint: string, data?: any) => {
    return await router.routePost(endpoint, data);
  });

  ipcMain.handle('api:put', async (_event, endpoint: string, data?: any) => {
    return await router.routePut(endpoint, data);
  });

  ipcMain.handle('api:delete', async (_event, endpoint: string) => {
    return await router.routeDelete(endpoint);
  });

  /**
   * Web Scraping API - used by ProductNew component
   */
  ipcMain.handle('api:scrape-product', async (_event, request) => {
    try {
      // For now, return mock data to maintain compatibility
      // TODO: Integrate with Python scraping pipeline
      
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
      await delay(2000); // Simulate scraping time
      
      // Simulate random success/failure (10% failure rate)
      if (Math.random() < 0.1) {
        return {
          success: false,
          error: 'Unable to extract product information from the provided URL'
        };
      }

      // Return mock scraped data matching expected format
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
          product_name: `Premium Product`,
          manufacturer: ['Acme Corp', 'BuildPro', 'QualityFirst', 'TechBuilder', 'ModernDesign'][Math.floor(Math.random() * 5)],
          price: Math.floor(Math.random() * 500) + 50,
        }
      };
    } catch (error) {
      console.error('Error scraping product:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Scraping failed'
      };
    }
  });

  console.log('✅ API IPC handlers registered');
}