import { ipcMain } from 'electron';
import { ProjectState } from '../services/ProjectState';
import { logger } from '../../shared/logging/Logger';

var log = logger.for('apiHandlers');
// Using internal schema end-to-end; no API->internal transforms needed

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
    
    log.info(`routeGet: ${normalizedEndpoint}`);
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
      
      if (normalizedEndpoint.match(/^\/categories\/([^/]+)$/)) {
        const categoryId = normalizedEndpoint.split('/')[2];
        return await this.updateCategory(categoryId, data);
      }
      
      if (normalizedEndpoint.match(/^\/locations\/([^/]+)$/)) {
        const locationId = normalizedEndpoint.split('/')[2];
        return await this.updateLocation(locationId, data);
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
      
      if (normalizedEndpoint.match(/^\/categories\/([^/]+)$/)) {
        const categoryId = normalizedEndpoint.split('/')[2];
        return await this.deleteCategory(categoryId);
      }
      
      if (normalizedEndpoint.match(/^\/locations\/([^/]+)$/)) {
        const locationId = normalizedEndpoint.split('/')[2];
        return await this.deleteLocation(locationId);
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

    // Get all products first
    let products = await manager.getProducts({
      category: params.category,
      location: params.location
    });

    // Apply search filter
    if (params.search && params.search.trim()) {
      const searchTerm = params.search.toLowerCase().trim();
      products = products.filter(product => {
        const productName = (product.productName || '').toLowerCase();
        const type = (product.type || '').toLowerCase();
        const manufacturer = (product.manufacturer || '').toLowerCase();
        
        return productName.includes(searchTerm) || 
               type.includes(searchTerm) || 
               manufacturer.includes(searchTerm);
      });
    }

    // Apply category filter (by name)
    if (params.category && params.category.trim()) {
      const categoryFilter = params.category.trim();
      products = products.filter(product => {
        const categoryIds = Array.isArray(product.category) ? product.category : [product.category].filter(Boolean);
        // We need to convert category IDs to names for comparison
        // For now, we'll assume the filter is by ID until we implement name-based filtering
        return categoryIds.includes(categoryFilter);
      });
    }

    // Apply location filter (by name)
    if (params.location && params.location.trim()) {
      const locationFilter = params.location.trim();
      products = products.filter(product => {
        const locationIds = Array.isArray(product.location) ? product.location : [product.location].filter(Boolean);
        // We need to convert location IDs to names for comparison
        // For now, we'll assume the filter is by ID until we implement name-based filtering
        return locationIds.includes(locationFilter);
      });
    }

    // Apply manufacturer filter
    if (params.manufacturer && params.manufacturer.trim()) {
      products = products.filter(product => product.manufacturer === params.manufacturer.trim());
    }

    // Apply sorting
    if (params.sortBy) {
      products.sort((a, b) => {
        switch (params.sortBy) {
          case 'name': {
            const aName = a.productName || a.type || '';
            const bName = b.productName || b.type || '';
            return aName.localeCompare(bName);
          }
          case 'manufacturer': {
            const aManufacturer = a.manufacturer || '';
            const bManufacturer = b.manufacturer || '';
            return aManufacturer.localeCompare(bManufacturer);
          }
          case 'price': {
            const aPrice = a.price || 0;
            const bPrice = b.price || 0;
            return aPrice - bPrice;
          }
          case 'tagId': {
            const aTagId = a.tagId || '';
            const bTagId = b.tagId || '';
            return aTagId.localeCompare(bTagId);
          }
          case 'date':
          default:
            return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        }
      });
    }

    // Apply pagination (skip if fetchAll is requested)
    if (params.fetchAll) {
      return {
        success: true,
        data: products,
        pagination: {
          page: 1,
          limit: products.length,
          total: products.length,
          pages: 1
        }
      };
    }

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
      log.error(`Product not found: ${productId}`);
      throw new Error('Product not found');
    }

    log.info(`Product found: ${productId}`, { product });
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

  // TODO: use a shared type object for product data
  private async createProduct(data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    try {
      // Accept internal fields directly
      const productData = {
        projectId: 'current',
        url: data.url || '',
        tagId: data.tagId,
        location: data.location || [],
        type: data.type,
        specificationDescription: data.specificationDescription,
        category: data.category || [],
        productName: data.productName || '',
        manufacturer: data.manufacturer,
        price: data.price,
        primaryImageHash: data.primaryImageHash,
        primaryThumbnailHash: data.primaryThumbnailHash,
        additionalImagesHashes: data.additionalImagesHashes || []
      };
      
      const product = await manager.createProduct(productData);
      this.projectState.markDirty();
      
      // Return internal shape for renderer consumption
      return { 
        success: true, 
        data: product
      };
    } catch (error) {
      console.error('Failed to create product:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to create product'
      };
    }
  }

  private async updateProduct(productId: string, data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      log.error('No project open');
      throw new Error('No project open');
    }

    try {
      // Accept internal fields directly - no filtering needed
      // The database schema and validation should handle null constraints
      const product = await manager.updateProduct(productId, data);
      this.projectState.markDirty();
      
      log.info(`Product updated: ${productId}`, { product });
      // Return internal shape for renderer consumption
      return { 
        success: true, 
        data: product
      };
    } catch (error) {
      log.error('Failed to update product:', { error });
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update product'
      };
    }
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

    const location = await manager.createLocation(data.name);
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

    const category = await manager.createCategory(data.name);
    this.projectState.markDirty();
    return { success: true, data: category };
  }

  private async updateCategory(categoryId: string, data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    const category = await manager.updateCategory(categoryId, data.name);
    this.projectState.markDirty();
    return { success: true, data: category };
  }

  private async deleteCategory(categoryId: string) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    const deleted = await manager.deleteCategory(categoryId);
    
    if (!deleted) {
      throw new Error('Failed to delete category');
    }

    this.projectState.markDirty();
    return { success: true, data: { id: categoryId } };
  }

  private async updateLocation(locationId: string, data: any) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    const location = await manager.updateLocation(locationId, data.name);
    this.projectState.markDirty();
    return { success: true, data: location };
  }

  private async deleteLocation(locationId: string) {
    const state = this.projectState.getStateInfo();
    const manager = this.projectState.getManager();
    
    if (!state.isOpen || !manager) {
      throw new Error('No project open');
    }

    const deleted = await manager.deleteLocation(locationId);
    
    if (!deleted) {
      throw new Error('Failed to delete location');
    }

    this.projectState.markDirty();
    return { success: true, data: { id: locationId } };
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



  console.log('✅ API IPC handlers registered');
}