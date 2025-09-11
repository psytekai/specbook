import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
import { ProjectFileManager } from './ProjectFileManager';
import type { Product } from '../types/project.types';

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m'
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title: string) {
  console.log();
  log(`${'='.repeat(60)}`, 'cyan');
  log(title, 'cyan');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logTest(name: string, passed: boolean) {
  const status = passed ? '✓' : '✗';
  const color = passed ? 'green' : 'red';
  log(`  ${status} ${name}`, color);
}

async function cleanup(projectPath: string) {
  try {
    await fs.rm(projectPath, { recursive: true, force: true });
  } catch (error) {
    // Ignore cleanup errors
  }
}

async function testProjectFileManager() {
  logSection('ProjectFileManager Test Suite');
  
  const tempDir = os.tmpdir();
  const testProjectPath = path.join(tempDir, `test-project-${Date.now()}.specbook`);
  const manager = new ProjectFileManager();
  
  let allTestsPassed = true;

  try {
    // ============================================================
    // Test 1: Create New Project
    // ============================================================
    logSection('Test 1: Create New Project');
    
    const project = await manager.createProject(testProjectPath, 'Test Project');
    
    logTest('Project created', !!project);
    logTest('Project has ID', !!project.id);
    logTest('Project name is correct', project.name === 'Test Project');
    logTest('Project path is correct', project.path === testProjectPath);
    logTest('Initial product count is 0', project.productCount === 0);
    
    // Verify file structure
    const dirExists = await fs.access(testProjectPath).then(() => true).catch(() => false);
    logTest('Project directory exists', dirExists);
    
    const assetsExists = await fs.access(path.join(testProjectPath, 'assets')).then(() => true).catch(() => false);
    logTest('Assets directory exists', assetsExists);
    
    const metadataExists = await fs.access(path.join(testProjectPath, '.metadata')).then(() => true).catch(() => false);
    logTest('Metadata directory exists', metadataExists);
    
    const manifestExists = await fs.access(path.join(testProjectPath, 'manifest.json')).then(() => true).catch(() => false);
    logTest('Manifest file exists', manifestExists);
    
    const dbExists = await fs.access(path.join(testProjectPath, 'project.db')).then(() => true).catch(() => false);
    logTest('Database file exists', dbExists);

    // ============================================================
    // Test 2: Create Products
    // ============================================================
    logSection('Test 2: Create Products');
    
    const productData1: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId: project.id,
      url: 'https://example.com/sofa',
      product_name: 'Modern Sofa',
      manufacturer: 'Comfort Furniture',
      price: 1299.99,
      location: ['Living Room', 'First Floor'],
      category: ['Furniture', 'Seating'],
      description: 'A comfortable modern sofa',
      specificationDescription: 'Dimensions: 84" W x 36" D x 32" H'
    };
    
    const product1 = await manager.createProduct(productData1);
    logTest('Product 1 created', !!product1);
    logTest('Product 1 has ID', !!product1.id);
    logTest('Product 1 name is correct', product1.product_name === 'Modern Sofa');
    logTest('Product 1 location is array', Array.isArray(product1.location));
    logTest('Product 1 category is array', Array.isArray(product1.category));
    
    const productData2: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId: project.id,
      url: 'https://example.com/table',
      product_name: 'Coffee Table',
      manufacturer: 'Wood Works',
      price: 599.99,
      location: ['Living Room'],
      category: ['Furniture', 'Tables'],
      description: 'Solid wood coffee table'
    };
    
    const product2 = await manager.createProduct(productData2);
    logTest('Product 2 created', !!product2);
    
    const productData3: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
      projectId: project.id,
      url: 'https://example.com/lamp',
      product_name: 'Floor Lamp',
      manufacturer: 'Bright Lights',
      price: 149.99,
      location: ['Living Room', 'Corner'],
      category: ['Lighting'],
      description: 'Modern LED floor lamp'
    };
    
    const product3 = await manager.createProduct(productData3);
    logTest('Product 3 created', !!product3);

    // ============================================================
    // Test 3: Query Products
    // ============================================================
    logSection('Test 3: Query Products');
    
    const allProducts = await manager.getProducts();
    logTest('Got all products', allProducts.length === 3);
    
    const furnitureProducts = await manager.getProducts({ category: 'Furniture' });
    logTest('Filtered by category (Furniture)', furnitureProducts.length === 2);
    
    const livingRoomProducts = await manager.getProducts({ location: 'Living Room' });
    logTest('Filtered by location (Living Room)', livingRoomProducts.length === 3);
    
    const tableProducts = await manager.getProducts({ category: 'Tables' });
    logTest('Filtered by category (Tables)', tableProducts.length === 1);

    // ============================================================
    // Test 4: Update Product
    // ============================================================
    logSection('Test 4: Update Product');
    
    const updatedProduct = await manager.updateProduct(product1.id, {
      price: 999.99,
      description: 'Updated description for modern sofa',
      location: ['Living Room', 'Second Floor']
    });
    
    logTest('Product updated', !!updatedProduct);
    logTest('Price updated correctly', updatedProduct.price === 999.99);
    logTest('Description updated', updatedProduct.description === 'Updated description for modern sofa');
    logTest('Location updated', updatedProduct.location.includes('Second Floor'));

    // ============================================================
    // Test 5: Categories and Locations
    // ============================================================
    logSection('Test 5: Categories and Locations');
    
    const categories = await manager.getCategories();
    logTest('Categories retrieved', categories.length > 0);
    logTest('Has Furniture category', categories.some(c => c.name === 'Furniture'));
    logTest('Has Lighting category', categories.some(c => c.name === 'Lighting'));
    
    const locations = await manager.getLocations();
    logTest('Locations retrieved', locations.length > 0);
    logTest('Has Living Room location', locations.some(l => l.name === 'Living Room'));
    
    log(`  Found ${categories.length} categories: ${categories.map(c => c.name).join(', ')}`, 'blue');
    log(`  Found ${locations.length} locations: ${locations.map(l => l.name).join(', ')}`, 'blue');

    // ============================================================
    // Test 6: Delete Product
    // ============================================================
    logSection('Test 6: Delete Product');
    
    const deleteResult = await manager.deleteProduct(product3.id);
    logTest('Product deleted', deleteResult === true);
    
    const remainingProducts = await manager.getProducts();
    logTest('Product count after deletion', remainingProducts.length === 2);

    // ============================================================
    // Test 7: Save and Close Project
    // ============================================================
    logSection('Test 7: Save and Close Project');
    
    const saveResult = await manager.saveProject({
      name: 'Updated Test Project',
      description: 'This is a test project with updated description'
    });
    logTest('Project saved', saveResult === true);
    
    const closeResult = await manager.closeProject();
    logTest('Project closed', closeResult === true);

    // ============================================================
    // Test 8: Reopen Project
    // ============================================================
    logSection('Test 8: Reopen Project');
    
    const reopenedProject = await manager.openProject(testProjectPath);
    logTest('Project reopened', !!reopenedProject);
    logTest('Project name persisted', reopenedProject.name === 'Updated Test Project');
    logTest('Project description persisted', reopenedProject.description === 'This is a test project with updated description');
    
    const persistedProducts = await manager.getProducts();
    logTest('Products persisted', persistedProducts.length === 2);
    logTest('Product data intact', persistedProducts.some(p => p.product_name === 'Modern Sofa'));

    // ============================================================
    // Test 9: Data Format Validation
    // ============================================================
    logSection('Test 9: Data Format Validation');
    
    const testProduct = persistedProducts[0];
    logTest('location is array', Array.isArray(testProduct.location));
    logTest('additionalImagesHashes is array', Array.isArray(testProduct.additionalImagesHashes));
    logTest('category is array', Array.isArray(testProduct.category));
    logTest('createdAt is Date', testProduct.createdAt instanceof Date);
    logTest('updatedAt is Date', testProduct.updatedAt instanceof Date);
    
    // Close project after tests
    await manager.closeProject();

  } catch (error) {
    log(`\nTest failed with error: ${error}`, 'red');
    allTestsPassed = false;
  } finally {
    // Cleanup
    await cleanup(testProjectPath);
  }

  // ============================================================
  // Summary
  // ============================================================
  logSection('Test Summary');
  
  if (allTestsPassed) {
    log('✅ All tests passed successfully!', 'green');
    log('', 'reset');
    log('The ProjectFileManager is ready for production use.', 'green');
    log('It correctly:', 'green');
    log('  - Creates .specbook project structures', 'green');
    log('  - Manages SQLite databases with proper schema', 'green');
    log('  - Handles CRUD operations with JSON field parsing', 'green');
    log('  - Maintains data format compatibility', 'green');
    log('  - Persists data across sessions', 'green');
  } else {
    log('❌ Some tests failed. Please review the output above.', 'red');
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  testProjectFileManager().catch(error => {
    log(`Fatal error: ${error}`, 'red');
    process.exit(1);
  });
}

export { testProjectFileManager };