import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { 
  Project, 
  Product, 
  Category, 
  Location, 
  Manifest,
  ProjectFileManagerOptions 
} from '../types/project.types';

/**
 * ProjectFileManager handles all file-based operations for .specbook projects
 * including database management, file structure creation, and CRUD operations.
 */
export class ProjectFileManager {
  private db: Database.Database | null = null;
  private currentProject: Project | null = null;
  private projectPath: string | null = null;

  constructor(_options: ProjectFileManagerOptions = {}) {
    // Options reserved for future use (autoSave, backupOnSave, etc.)
    // Currently not implemented
  }

  // ============================================================
  // Project Structure Creation
  // ============================================================

  /**
   * Creates a new .specbook directory with all required subdirectories
   */
  async createProjectStructure(projectPath: string): Promise<void> {
    try {
      // Ensure the path ends with .specbook
      if (!projectPath.endsWith('.specbook')) {
        projectPath = `${projectPath}.specbook`;
      }

      // Create main directory
      await fs.mkdir(projectPath, { recursive: true });

      // Create subdirectories
      await fs.mkdir(path.join(projectPath, 'assets'), { recursive: true });
      await fs.mkdir(path.join(projectPath, 'assets', 'thumbnails'), { recursive: true });
      await fs.mkdir(path.join(projectPath, '.metadata'), { recursive: true });

      console.log(`Created project structure at: ${projectPath}`);
    } catch (error) {
      throw new Error(`Failed to create project structure: ${error}`);
    }
  }

  /**
   * Initializes SQLite database with correct schema
   */
  async initializeDatabase(projectPath: string): Promise<Database.Database> {
    try {
      const dbPath = path.join(projectPath, 'project.db');
      
      // Create database connection
      const db = new Database(dbPath);
      
      // Enable foreign keys
      db.exec('PRAGMA foreign_keys = ON');

      // Create products table
      db.exec(`
        CREATE TABLE IF NOT EXISTS products (
          id TEXT PRIMARY KEY,
          projectId TEXT NOT NULL,
          url TEXT NOT NULL,
          tagId TEXT,
          location TEXT,
          image TEXT,
          images TEXT,
          description TEXT,
          specificationDescription TEXT,
          category TEXT,
          product_name TEXT,
          manufacturer TEXT,
          price REAL,
          custom_image_url TEXT,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create categories table
      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create locations table
      db.exec(`
        CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create update trigger for products
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
        AFTER UPDATE ON products
        BEGIN
          UPDATE products SET updatedAt = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      console.log(`Initialized database at: ${dbPath}`);
      return db;
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  /**
   * Creates and saves manifest.json
   */
  async createManifest(projectPath: string, projectData: Partial<Project>): Promise<void> {
    try {
      const manifest: Manifest = {
        version: '1.0.0',
        format: 'specbook-project',
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
        project: {
          id: projectData.id || uuidv4(),
          name: projectData.name || 'Untitled Project',
          description: projectData.description,
          productCount: 0
        }
      };

      const manifestPath = path.join(projectPath, 'manifest.json');
      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      console.log(`Created manifest at: ${manifestPath}`);
    } catch (error) {
      throw new Error(`Failed to create manifest: ${error}`);
    }
  }

  // ============================================================
  // CRUD Operations
  // ============================================================

  /**
   * Gets all products with optional filtering
   */
  async getProducts(filters?: { category?: string; location?: string }): Promise<Product[]> {
    if (!this.db) {
      throw new Error('No project is currently open');
    }

    try {
      let query = 'SELECT * FROM products WHERE 1=1';
      const params: any[] = [];

      if (filters?.category) {
        query += ' AND category LIKE ?';
        params.push(`%${filters.category}%`);
      }

      if (filters?.location) {
        query += ' AND location LIKE ?';
        params.push(`%${filters.location}%`);
      }

      query += ' ORDER BY createdAt DESC';

      const stmt = this.db.prepare(query);
      const rows = stmt.all(...params) as any[];

      return rows.map(row => this.parseProductRow(row));
    } catch (error) {
      throw new Error(`Failed to get products: ${error}`);
    }
  }

  /**
   * Creates a new product
   */
  async createProduct(productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'>): Promise<Product> {
    if (!this.db || !this.currentProject) {
      throw new Error('No project is currently open');
    }

    try {
      const id = uuidv4();
      const now = new Date();

      const stmt = this.db.prepare(`
        INSERT INTO products (
          id, projectId, url, tagId, location, image, images, 
          description, specificationDescription, category, 
          product_name, manufacturer, price, custom_image_url,
          createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        id,
        productData.projectId || this.currentProject.id,
        productData.url,
        productData.tagId || null,
        JSON.stringify(productData.location || []),
        productData.image || null,
        JSON.stringify(productData.images || []),
        productData.description || null,
        productData.specificationDescription || null,
        JSON.stringify(productData.category || []),
        productData.product_name,
        productData.manufacturer || null,
        productData.price || null,
        productData.custom_image_url || null,
        now.toISOString(),
        now.toISOString()
      );

      // Update product count in manifest
      await this.updateProductCount();

      // Extract and store categories and locations
      await this.extractAndStoreCategories(productData.category || []);
      await this.extractAndStoreLocations(productData.location || []);

      const product: Product = {
        ...productData,
        id,
        projectId: productData.projectId || this.currentProject.id,
        createdAt: now,
        updatedAt: now
      };

      return product;
    } catch (error) {
      throw new Error(`Failed to create product: ${error}`);
    }
  }

  /**
   * Updates an existing product
   */
  async updateProduct(id: string, updates: Partial<Product>): Promise<Product> {
    if (!this.db) {
      throw new Error('No project is currently open');
    }

    try {
      // Get existing product
      const existing = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      if (!existing) {
        throw new Error(`Product not found: ${id}`);
      }

      // Build update query
      const updateFields: string[] = [];
      const values: any[] = [];

      if (updates.url !== undefined) {
        updateFields.push('url = ?');
        values.push(updates.url);
      }
      if (updates.tagId !== undefined) {
        updateFields.push('tagId = ?');
        values.push(updates.tagId);
      }
      if (updates.location !== undefined) {
        updateFields.push('location = ?');
        values.push(JSON.stringify(updates.location));
        await this.extractAndStoreLocations(updates.location);
      }
      if (updates.image !== undefined) {
        updateFields.push('image = ?');
        values.push(updates.image);
      }
      if (updates.images !== undefined) {
        updateFields.push('images = ?');
        values.push(JSON.stringify(updates.images));
      }
      if (updates.description !== undefined) {
        updateFields.push('description = ?');
        values.push(updates.description);
      }
      if (updates.specificationDescription !== undefined) {
        updateFields.push('specificationDescription = ?');
        values.push(updates.specificationDescription);
      }
      if (updates.category !== undefined) {
        updateFields.push('category = ?');
        values.push(JSON.stringify(updates.category));
        await this.extractAndStoreCategories(updates.category);
      }
      if (updates.product_name !== undefined) {
        updateFields.push('product_name = ?');
        values.push(updates.product_name);
      }
      if (updates.manufacturer !== undefined) {
        updateFields.push('manufacturer = ?');
        values.push(updates.manufacturer);
      }
      if (updates.price !== undefined) {
        updateFields.push('price = ?');
        values.push(updates.price);
      }
      if (updates.custom_image_url !== undefined) {
        updateFields.push('custom_image_url = ?');
        values.push(updates.custom_image_url);
      }

      if (updateFields.length === 0) {
        // No updates, return existing
        return this.parseProductRow(existing);
      }

      values.push(id);
      const query = `UPDATE products SET ${updateFields.join(', ')} WHERE id = ?`;
      this.db.prepare(query).run(...values);

      // Get updated product
      const updated = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      return this.parseProductRow(updated);
    } catch (error) {
      throw new Error(`Failed to update product: ${error}`);
    }
  }

  /**
   * Deletes a product
   */
  async deleteProduct(id: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('No project is currently open');
    }

    try {
      const stmt = this.db.prepare('DELETE FROM products WHERE id = ?');
      const result = stmt.run(id);

      if (result.changes > 0) {
        await this.updateProductCount();
        return true;
      }

      return false;
    } catch (error) {
      throw new Error(`Failed to delete product: ${error}`);
    }
  }

  /**
   * Gets all categories
   */
  async getCategories(): Promise<Category[]> {
    if (!this.db) {
      throw new Error('No project is currently open');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM categories ORDER BY name');
      const rows = stmt.all() as any[];

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        createdAt: new Date(row.createdAt)
      }));
    } catch (error) {
      throw new Error(`Failed to get categories: ${error}`);
    }
  }

  /**
   * Gets all locations
   */
  async getLocations(): Promise<Location[]> {
    if (!this.db) {
      throw new Error('No project is currently open');
    }

    try {
      const stmt = this.db.prepare('SELECT * FROM locations ORDER BY name');
      const rows = stmt.all() as any[];

      return rows.map(row => ({
        id: row.id,
        name: row.name,
        createdAt: new Date(row.createdAt)
      }));
    } catch (error) {
      throw new Error(`Failed to get locations: ${error}`);
    }
  }

  // ============================================================
  // Project Operations
  // ============================================================

  /**
   * Creates a new project
   */
  async createProject(projectPath: string, projectName: string): Promise<Project> {
    try {
      // Ensure .specbook extension
      if (!projectPath.endsWith('.specbook')) {
        projectPath = `${projectPath}.specbook`;
      }

      // Create project structure
      await this.createProjectStructure(projectPath);

      // Initialize project object
      const project: Project = {
        id: uuidv4(),
        name: projectName,
        productCount: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
        path: projectPath
      };

      // Create manifest
      await this.createManifest(projectPath, project);

      // Initialize database
      this.db = await this.initializeDatabase(projectPath);

      // Set current project
      this.currentProject = project;
      this.projectPath = projectPath;

      return project;
    } catch (error) {
      // Clean up on error
      await this.closeProject();
      throw new Error(`Failed to create project: ${error}`);
    }
  }

  /**
   * Opens an existing project
   */
  async openProject(projectPath: string): Promise<Project> {
    try {
      // Ensure .specbook extension
      if (!projectPath.endsWith('.specbook')) {
        projectPath = `${projectPath}.specbook`;
      }

      // Check if project exists
      await fs.access(projectPath);

      // Read manifest
      const manifestPath = path.join(projectPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(manifestData);

      // Initialize database (this will create tables if they don't exist)
      this.db = await this.initializeDatabase(projectPath);

      // Create project object
      const project: Project = {
        id: manifest.project.id,
        name: manifest.project.name,
        description: manifest.project.description,
        productCount: manifest.project.productCount,
        createdAt: new Date(manifest.created),
        updatedAt: new Date(manifest.modified),
        path: projectPath
      };

      this.currentProject = project;
      this.projectPath = projectPath;

      return project;
    } catch (error) {
      await this.closeProject();
      throw new Error(`Failed to open project: ${error}`);
    }
  }

  /**
   * Saves project updates
   */
  async saveProject(updates: Partial<Project>): Promise<boolean> {
    if (!this.currentProject || !this.projectPath) {
      throw new Error('No project is currently open');
    }

    try {
      // Update current project
      if (updates.name !== undefined) {
        this.currentProject.name = updates.name;
      }
      if (updates.description !== undefined) {
        this.currentProject.description = updates.description;
      }

      this.currentProject.updatedAt = new Date();

      // Update manifest
      const manifestPath = path.join(this.projectPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(manifestData);

      manifest.modified = this.currentProject.updatedAt.toISOString();
      manifest.project.name = this.currentProject.name;
      manifest.project.description = this.currentProject.description;

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

      return true;
    } catch (error) {
      throw new Error(`Failed to save project: ${error}`);
    }
  }

  /**
   * Closes the current project
   */
  async closeProject(): Promise<boolean> {
    try {
      if (this.db) {
        this.db.close();
        this.db = null;
      }

      this.currentProject = null;
      this.projectPath = null;

      return true;
    } catch (error) {
      console.error('Error closing project:', error);
      return false;
    }
  }

  // ============================================================
  // Helper Methods
  // ============================================================

  /**
   * Parses a database row into a Product object
   */
  private parseProductRow(row: any): Product {
    return {
      id: row.id,
      projectId: row.projectId,
      url: row.url,
      tagId: row.tagId,
      location: row.location ? JSON.parse(row.location) : [],
      image: row.image,
      images: row.images ? JSON.parse(row.images) : [],
      description: row.description,
      specificationDescription: row.specificationDescription,
      category: row.category ? JSON.parse(row.category) : [],
      product_name: row.product_name,
      manufacturer: row.manufacturer,
      price: row.price,
      custom_image_url: row.custom_image_url,
      createdAt: new Date(row.createdAt),
      updatedAt: new Date(row.updatedAt)
    };
  }

  /**
   * Updates the product count in the manifest
   */
  private async updateProductCount(): Promise<void> {
    if (!this.db || !this.projectPath || !this.currentProject) return;

    try {
      const count = this.db.prepare('SELECT COUNT(*) as count FROM products').get() as any;
      this.currentProject.productCount = count.count;

      // Update manifest
      const manifestPath = path.join(this.projectPath, 'manifest.json');
      const manifestData = await fs.readFile(manifestPath, 'utf-8');
      const manifest: Manifest = JSON.parse(manifestData);

      manifest.project.productCount = count.count;
      manifest.modified = new Date().toISOString();

      await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    } catch (error) {
      console.error('Failed to update product count:', error);
    }
  }

  /**
   * Extracts and stores unique categories
   */
  private async extractAndStoreCategories(categories: string[]): Promise<void> {
    if (!this.db || !categories || categories.length === 0) return;

    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO categories (id, name) VALUES (?, ?)
      `);

      for (const category of categories) {
        if (category && category.trim()) {
          stmt.run(uuidv4(), category.trim());
        }
      }
    } catch (error) {
      console.error('Failed to store categories:', error);
    }
  }

  /**
   * Extracts and stores unique locations
   */
  private async extractAndStoreLocations(locations: string[]): Promise<void> {
    if (!this.db || !locations || locations.length === 0) return;

    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO locations (id, name) VALUES (?, ?)
      `);

      for (const location of locations) {
        if (location && location.trim()) {
          stmt.run(uuidv4(), location.trim());
        }
      }
    } catch (error) {
      console.error('Failed to store locations:', error);
    }
  }

  /**
   * Gets the current project
   */
  getCurrentProject(): Project | null {
    return this.currentProject;
  }

  /**
   * Gets the current database connection
   */
  getDatabase(): Database.Database | null {
    return this.db;
  }
}