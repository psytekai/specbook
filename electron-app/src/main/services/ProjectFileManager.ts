import * as fs from 'fs/promises';
import * as path from 'path';
import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import { AssetManager } from './AssetManager';
import { mapDbRowToInterface, mapInterfaceToDb } from '../../shared/mappings/fieldMappings';
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
          project_id TEXT NOT NULL,
          url TEXT NOT NULL,
          tag_id TEXT NOT NULL,
          location TEXT NOT NULL,
          type TEXT,
          specification_description TEXT,
          category TEXT NOT NULL,
          product_name TEXT NOT NULL,
          manufacturer TEXT,
          price REAL,
          primary_image_hash TEXT,
          primary_thumbnail_hash TEXT,
          additional_images_hashes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create categories table
      db.exec(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create locations table
      db.exec(`
        CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          name TEXT UNIQUE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `);

      // Create update trigger for products
      db.exec(`
        CREATE TRIGGER IF NOT EXISTS update_products_timestamp 
        AFTER UPDATE ON products
        BEGIN
          UPDATE products SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
        END
      `);

      console.log(`Initialized database at: ${dbPath}`);
      return db;
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error}`);
    }
  }

  /**
   * Check and apply database migrations for existing projects
   */
  async migrateDatabase(db: Database.Database): Promise<void> {
    try {
      // Apply versioned migrations
      const currentVersion = this.getSchemaVersion(db);
      const targetVersion = 2; // Latest schema version
      
      for (let version = currentVersion + 1; version <= targetVersion; version++) {
        console.log(`Applying migration version ${version}...`);
        this.applyMigration(db, version);
      }
      
      console.log('Database migration completed successfully');
    } catch (error) {
      console.error('Database migration failed:', error);
      throw new Error(`Failed to migrate database: ${error}`);
    }
  }

  /**
   * Get database schema version
   */
  getSchemaVersion(db: Database.Database): number {
    try {
      // Check if schema_version table exists
      const tableExists = db.prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
      ).get();
      
      if (!tableExists) {
        // Create schema version table
        db.exec(`
          CREATE TABLE schema_version (
            version INTEGER PRIMARY KEY,
            applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Insert initial version
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(1);
        return 1;
      }
      
      // Get current version
      const result = db.prepare('SELECT MAX(version) as version FROM schema_version').get() as {version: number};
      return result?.version || 1;
    } catch (error) {
      console.error('Error getting schema version:', error);
      return 1;
    }
  }

  /**
   * Apply specific schema version migration
   */
  applyMigration(db: Database.Database, version: number): void {
    const migrations: Record<number, () => void> = {
      1: () => {
        // Migration: Add asset management columns and tables
        console.log('Adding asset management columns and tables...');
        
        // Check if asset columns exist
        const tableInfo = db.prepare("PRAGMA table_info(products)").all() as Array<{name: string}>;
        const columnNames = tableInfo.map(col => col.name);
        
        // Add asset management columns if they don't exist
        const assetColumns = [
          { name: 'primary_image_hash', type: 'TEXT' },
          { name: 'primary_thumbnail_hash', type: 'TEXT' },
          { name: 'additional_images_hashes', type: 'TEXT' }  // JSON array of hashes
        ];
        
        for (const column of assetColumns) {
          if (!columnNames.includes(column.name)) {
            console.log(`Adding column ${column.name} to products table...`);
            db.exec(`ALTER TABLE products ADD COLUMN ${column.name} ${column.type}`);
          }
        }
        
        // Create assets metadata table for tracking
        db.exec(`
          CREATE TABLE IF NOT EXISTS assets (
            hash TEXT PRIMARY KEY,
            original_name TEXT,
            mimetype TEXT,
            size INTEGER,
            width INTEGER,
            height INTEGER,
            thumbnail_hash TEXT,
            ref_count INTEGER DEFAULT 1,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `);
        
        // Create index for faster lookups
        db.exec(`
          CREATE INDEX IF NOT EXISTS idx_assets_ref_count ON assets(ref_count);
          CREATE INDEX IF NOT EXISTS idx_assets_last_accessed ON assets(last_accessed);
        `);
        
        console.log('Successfully added asset management columns and tables');
      },
      2: () => {
        // Migration: Rename description column to type and swap data with specification_description
        console.log('Renaming description column to type and swapping data...');
        
        // Step 1: Add temporary columns to hold data during swap
        db.exec('ALTER TABLE products ADD COLUMN temp_description TEXT');
        db.exec('ALTER TABLE products ADD COLUMN temp_spec_desc TEXT');
        
        // Step 2: Copy current data to temporary columns
        db.exec('UPDATE products SET temp_description = description');
        db.exec('UPDATE products SET temp_spec_desc = specification_description');
        
        // Step 3: Rename description column to type
        db.exec('ALTER TABLE products RENAME COLUMN description TO type');
        
        // Step 4: Perform the data swap
        // Move temp_spec_desc (originally specification_description) to type
        db.exec('UPDATE products SET type = temp_spec_desc');
        // Move temp_description (originally description) to specification_description
        db.exec('UPDATE products SET specification_description = temp_description');
        
        // Step 5: Drop the temporary columns
        db.exec('ALTER TABLE products DROP COLUMN temp_description');
        db.exec('ALTER TABLE products DROP COLUMN temp_spec_desc');
        
        console.log('Successfully renamed description column to type and swapped data with specification_description');
      }
    };
    
    if (migrations[version]) {
      db.transaction(() => {
        migrations[version]();
        db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(version);
      })();
      console.log(`Applied migration version ${version}`);
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

      // Fix: Use snake_case column name in SQL query
      query += ' ORDER BY created_at DESC';

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
      // Validate required fields
      if (!productData.url) throw new Error('Product URL is required');
      if (!productData.tagId) throw new Error('Tag ID is required');
      if (!productData.productName) throw new Error('Product name is required');
      if (!productData.location || productData.location.length === 0) throw new Error('At least one location is required');
      if (!productData.category || productData.category.length === 0) throw new Error('At least one category is required');
      
      const id = uuidv4();
      const now = new Date().toISOString();
      
      // Map interface fields to database column names
      const dbData = mapInterfaceToDb({
        ...productData,
        id,
        createdAt: now,
        updatedAt: now
      });
      
      const stmt = this.db.prepare(`
        INSERT INTO products (
          id, project_id, url, tag_id, location,
          type, specification_description, category, 
          product_name, manufacturer, price,
          primary_image_hash, primary_thumbnail_hash, additional_images_hashes,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      stmt.run(
        dbData.id,
        dbData.project_id || this.currentProject.id,
        dbData.url,
        dbData.tag_id, // Required field, validated above
        JSON.stringify(productData.location), // Required field, validated above
        dbData.type || null,
        dbData.specification_description || null,
        JSON.stringify(productData.category), // Required field, validated above
        dbData.product_name, // Required field, validated above
        dbData.manufacturer || null,
        dbData.price || null,
        dbData.primary_image_hash || null,
        dbData.primary_thumbnail_hash || null,
        JSON.stringify(productData.additionalImagesHashes || []),
        dbData.created_at,
        dbData.updated_at
      );

      // Update product count in manifest
      await this.updateProductCount();

      // Extract and store categories and locations
      await this.extractAndStoreCategories(productData.category || []);
      await this.extractAndStoreLocations(productData.location || []);

      // Get the created product using the same parsing logic
      const createdRow = this.db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      return this.parseProductRow(createdRow);
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

      // Validate required fields if they're being updated
      if (updates.url !== undefined && !updates.url) throw new Error('Product URL cannot be empty');
      if (updates.tagId !== undefined && !updates.tagId) throw new Error('Tag ID cannot be empty');
      if (updates.productName !== undefined && !updates.productName) throw new Error('Product name cannot be empty');
      if (updates.location !== undefined && (!updates.location || updates.location.length === 0)) throw new Error('At least one location is required');
      if (updates.category !== undefined && (!updates.category || updates.category.length === 0)) throw new Error('At least one category is required');

      // Build update query
      const updateFields: string[] = [];
      const values: any[] = [];

      if (updates.url !== undefined) {
        updateFields.push('url = ?');
        values.push(updates.url);
      }
      if (updates.tagId !== undefined) {
        updateFields.push('tag_id = ?');
        values.push(updates.tagId);
      }
      if (updates.location !== undefined) {
        updateFields.push('location = ?');
        values.push(JSON.stringify(updates.location));
        await this.extractAndStoreLocations(updates.location);
      }
      if (updates.type !== undefined) {
        updateFields.push('type = ?');
        values.push(updates.type);
      }
      if (updates.specificationDescription !== undefined) {
        updateFields.push('specification_description = ?');
        values.push(updates.specificationDescription);
      }
      if (updates.category !== undefined) {
        updateFields.push('category = ?');
        values.push(JSON.stringify(updates.category));
        await this.extractAndStoreCategories(updates.category);
      }
      if (updates.productName !== undefined) {
        updateFields.push('product_name = ?');
        values.push(updates.productName);
      }
      if (updates.manufacturer !== undefined) {
        updateFields.push('manufacturer = ?');
        values.push(updates.manufacturer);
      }
      if (updates.price !== undefined) {
        updateFields.push('price = ?');
        values.push(updates.price);
      }
      // Asset management fields (Phase 4)
      if (updates.primaryImageHash !== undefined) {
        updateFields.push('primary_image_hash = ?');
        values.push(updates.primaryImageHash);
      }
      if (updates.primaryThumbnailHash !== undefined) {
        updateFields.push('primary_thumbnail_hash = ?');
        values.push(updates.primaryThumbnailHash);
      }
      if (updates.additionalImagesHashes !== undefined) {
        updateFields.push('additional_images_hashes = ?');
        values.push(JSON.stringify(updates.additionalImagesHashes));
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
   * Deletes a product and cleans up associated assets
   */
  async deleteProduct(id: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('No project is currently open');
    }

    try {
      // First, get the product to retrieve asset hashes before deletion
      const getStmt = this.db.prepare('SELECT primary_image_hash, primary_thumbnail_hash, additional_images_hashes FROM products WHERE id = ?');
      const product = getStmt.get(id) as { primary_image_hash?: string; primary_thumbnail_hash?: string; additional_images_hashes?: string } | undefined;

      // Delete the product from database
      const deleteStmt = this.db.prepare('DELETE FROM products WHERE id = ?');
      const result = deleteStmt.run(id);

      if (result.changes > 0) {
        // Clean up associated assets if they exist
        if (product && this.projectPath) {
          const assetManager = new AssetManager(this.projectPath, this.db);

          // Delete primary image asset
          if (product.primary_image_hash) {
            try {
              await assetManager.deleteAsset(product.primary_image_hash);
            } catch (error) {
              console.warn(`Failed to delete primary image asset ${product.primary_image_hash}:`, error);
            }
          }

          // Delete additional image assets
          if (product.additional_images_hashes) {
            try {
              const imageHashes = JSON.parse(product.additional_images_hashes) as string[];
              for (const hash of imageHashes) {
                try {
                  await assetManager.deleteAsset(hash);
                } catch (error) {
                  console.warn(`Failed to delete image asset ${hash}:`, error);
                }
              }
            } catch (error) {
              console.warn('Failed to parse additional_images_hashes for cleanup:', error);
            }
          }

          // Note: thumbnail_hash cleanup is handled automatically by AssetManager.deleteAsset()
          // when the main asset is deleted, as thumbnails are linked to their parent assets
        }

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
        createdAt: new Date(row.created_at)
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
        createdAt: new Date(row.created_at)
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
      
      // Apply latest schema (ensures new projects have all columns)
      await this.migrateDatabase(this.db);

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
      
      // Run migrations for existing projects
      await this.migrateDatabase(this.db);

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
    // First apply field name mappings
    const mappedRow = mapDbRowToInterface(row);
    
    // Then parse JSON fields and ensure correct types
    return {
      id: mappedRow.id,
      projectId: mappedRow.projectId,
      url: mappedRow.url,
      tagId: mappedRow.tagId || undefined,
      location: this.parseJsonArray(mappedRow.location),
      type: mappedRow.type || undefined,
      specificationDescription: mappedRow.specificationDescription || undefined,
      category: this.parseJsonArray(mappedRow.category),
      productName: mappedRow.productName,
      manufacturer: mappedRow.manufacturer || undefined,
      price: mappedRow.price || undefined,
      
      // Asset fields now properly mapped from snake_case
      primaryImageHash: mappedRow.primaryImageHash || undefined,
      primaryThumbnailHash: mappedRow.primaryThumbnailHash || undefined,
      additionalImagesHashes: this.parseJsonArray(mappedRow.additionalImagesHashes),
      
      createdAt: new Date(mappedRow.createdAt),
      updatedAt: new Date(mappedRow.updatedAt)
    };
  }

  private parseJsonArray(jsonField: string | null | undefined): string[] {
    if (!jsonField) return [];
    try {
      const parsed = JSON.parse(jsonField);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (error) {
      console.error('Failed to parse JSON array:', jsonField, error);
      return [];
    }
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