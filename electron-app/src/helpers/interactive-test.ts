#!/usr/bin/env node

import * as readline from 'readline';
import * as path from 'path';
import * as os from 'os';
import { ProjectFileManager } from './ProjectFileManager';
import type { Product } from '../types/project.types';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const manager = new ProjectFileManager();
let currentProjectPath: string | null = null;

const question = (query: string): Promise<string> => {
  return new Promise((resolve) => rl.question(query, resolve));
};

async function showMenu() {
  console.log('\n=== ProjectFileManager Interactive Test ===');
  console.log('1. Create new project');
  console.log('2. Open existing project');
  console.log('3. Add product');
  console.log('4. List products');
  console.log('5. Update product');
  console.log('6. Delete product');
  console.log('7. Show categories');
  console.log('8. Show locations');
  console.log('9. Save project');
  console.log('10. Close project');
  console.log('11. Current project info');
  console.log('0. Exit');
  console.log('==========================================');
}

async function createProject() {
  const name = await question('Project name: ');
  const location = await question('Project location (press Enter for temp): ') || os.tmpdir();
  const projectPath = path.join(location, `${name.replace(/\s+/g, '-')}.specbook`);
  
  try {
    const project = await manager.createProject(projectPath, name);
    currentProjectPath = projectPath;
    console.log(`✅ Project created at: ${projectPath}`);
    console.log(`   ID: ${project.id}`);
    console.log(`   Name: ${project.name}`);
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function openProject() {
  const projectPath = await question('Project path (.specbook): ');
  
  try {
    const project = await manager.openProject(projectPath);
    currentProjectPath = projectPath;
    console.log(`✅ Project opened: ${project.name}`);
    console.log(`   Products: ${project.productCount}`);
    console.log(`   Created: ${project.createdAt}`);
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function addProduct() {
  const currentProject = manager.getCurrentProject();
  if (!currentProject) {
    console.log('❌ No project is open');
    return;
  }

  console.log('\n📦 Add New Product');
  const productData: Omit<Product, 'id' | 'createdAt' | 'updatedAt'> = {
    projectId: currentProject.id,
    url: await question('URL: '),
    product_name: await question('Product name: '),
    manufacturer: await question('Manufacturer (optional): ') || undefined,
    price: parseFloat(await question('Price (optional): ') || '0') || undefined,
    description: await question('Description (optional): ') || undefined,
    location: (await question('Locations (comma-separated): ')).split(',').map(l => l.trim()).filter(Boolean),
    category: (await question('Categories (comma-separated): ')).split(',').map(c => c.trim()).filter(Boolean),
    images: (await question('Image URLs (comma-separated, optional): ')).split(',').map(i => i.trim()).filter(Boolean)
  };

  try {
    const product = await manager.createProduct(productData);
    console.log(`✅ Product created with ID: ${product.id}`);
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function listProducts() {
  try {
    const filterType = await question('Filter by (category/location/none): ');
    let filters: any = undefined;
    
    if (filterType === 'category') {
      const category = await question('Category name: ');
      filters = { category };
    } else if (filterType === 'location') {
      const location = await question('Location name: ');
      filters = { location };
    }

    const products = await manager.getProducts(filters);
    
    if (products.length === 0) {
      console.log('No products found');
      return;
    }

    console.log(`\n📋 Found ${products.length} products:\n`);
    products.forEach((p, i) => {
      console.log(`${i + 1}. ${p.product_name}`);
      console.log(`   ID: ${p.id}`);
      console.log(`   URL: ${p.url}`);
      console.log(`   Price: ${p.price ? `$${p.price}` : 'N/A'}`);
      console.log(`   Manufacturer: ${p.manufacturer || 'N/A'}`);
      console.log(`   Categories: ${p.category.join(', ') || 'None'}`);
      console.log(`   Locations: ${p.location.join(', ') || 'None'}`);
      console.log('');
    });
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function updateProduct() {
  const id = await question('Product ID to update: ');
  
  console.log('Enter new values (press Enter to skip):');
  const updates: Partial<Product> = {};
  
  const newName = await question('New name: ');
  if (newName) updates.product_name = newName;
  
  const newPrice = await question('New price: ');
  if (newPrice) updates.price = parseFloat(newPrice);
  
  const newDesc = await question('New description: ');
  if (newDesc) updates.description = newDesc;
  
  const newLocations = await question('New locations (comma-separated): ');
  if (newLocations) updates.location = newLocations.split(',').map(l => l.trim());
  
  const newCategories = await question('New categories (comma-separated): ');
  if (newCategories) updates.category = newCategories.split(',').map(c => c.trim());

  try {
    const product = await manager.updateProduct(id, updates);
    console.log(`✅ Product updated: ${product.product_name}`);
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function deleteProduct() {
  const id = await question('Product ID to delete: ');
  
  try {
    const result = await manager.deleteProduct(id);
    if (result) {
      console.log('✅ Product deleted');
    } else {
      console.log('❌ Product not found');
    }
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function showCategories() {
  try {
    const categories = await manager.getCategories();
    console.log(`\n📂 Categories (${categories.length}):`);
    categories.forEach(c => console.log(`  - ${c.name}`));
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function showLocations() {
  try {
    const locations = await manager.getLocations();
    console.log(`\n📍 Locations (${locations.length}):`);
    locations.forEach(l => console.log(`  - ${l.name}`));
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function saveProject() {
  const currentProject = manager.getCurrentProject();
  if (!currentProject) {
    console.log('❌ No project is open');
    return;
  }

  const newName = await question('New project name (press Enter to skip): ');
  const newDesc = await question('New description (press Enter to skip): ');
  
  const updates: any = {};
  if (newName) updates.name = newName;
  if (newDesc) updates.description = newDesc;

  try {
    await manager.saveProject(updates);
    console.log('✅ Project saved');
  } catch (error) {
    console.error(`❌ Error: ${error}`);
  }
}

async function showProjectInfo() {
  const project = manager.getCurrentProject();
  if (!project) {
    console.log('❌ No project is open');
    return;
  }

  console.log('\n📁 Current Project:');
  console.log(`  Name: ${project.name}`);
  console.log(`  ID: ${project.id}`);
  console.log(`  Path: ${project.path || currentProjectPath}`);
  console.log(`  Products: ${project.productCount}`);
  console.log(`  Description: ${project.description || 'None'}`);
  console.log(`  Created: ${project.createdAt}`);
  console.log(`  Updated: ${project.updatedAt}`);
}

async function main() {
  console.log('Welcome to ProjectFileManager Interactive Test!');
  
  while (true) {
    await showMenu();
    const choice = await question('\nEnter choice: ');
    
    switch (choice) {
      case '1':
        await createProject();
        break;
      case '2':
        await openProject();
        break;
      case '3':
        await addProduct();
        break;
      case '4':
        await listProducts();
        break;
      case '5':
        await updateProduct();
        break;
      case '6':
        await deleteProduct();
        break;
      case '7':
        await showCategories();
        break;
      case '8':
        await showLocations();
        break;
      case '9':
        await saveProject();
        break;
      case '10':
        await manager.closeProject();
        console.log('✅ Project closed');
        currentProjectPath = null;
        break;
      case '11':
        await showProjectInfo();
        break;
      case '0':
        console.log('Goodbye!');
        rl.close();
        process.exit(0);
      default:
        console.log('Invalid choice');
    }
  }
}

main().catch(console.error);