import * as path from 'path';
import * as os from 'os';
import { ProjectFileManager } from './ProjectFileManager';

async function quickDemo() {
  console.log('🚀 Quick ProjectFileManager Demo\n');
  
  const manager = new ProjectFileManager();
  const demoPath = path.join(os.homedir(), 'Desktop', 'DemoProject.specbook');
  
  try {
    // Create project
    console.log('1️⃣ Creating project on Desktop...');
    const project = await manager.createProject(demoPath, 'Demo Project');
    console.log(`   ✅ Created at: ${demoPath}\n`);
    
    // Add some products
    console.log('2️⃣ Adding sample products...');
    
    const product1 = await manager.createProduct({
      projectId: project.id,
      url: 'https://www.westelm.com/products/mid-century-sofa',
      product_name: 'Mid-Century Sofa',
      manufacturer: 'West Elm',
      price: 1899,
      location: ['Living Room'],
      category: ['Furniture', 'Sofas'],
      images: [],
      description: 'Beautiful mid-century modern sofa in walnut'
    });
    console.log(`   ✅ Added: ${product1.product_name}`);
    
    const product2 = await manager.createProduct({
      projectId: project.id,
      url: 'https://www.cb2.com/coffee-table',
      product_name: 'Glass Coffee Table',
      manufacturer: 'CB2',
      price: 699,
      location: ['Living Room'],
      category: ['Furniture', 'Tables'],
      images: [],
      description: 'Modern glass and steel coffee table'
    });
    console.log(`   ✅ Added: ${product2.product_name}`);
    
    const product3 = await manager.createProduct({
      projectId: project.id,
      url: 'https://www.restorationhardware.com/floor-lamp',
      product_name: 'Industrial Floor Lamp',
      manufacturer: 'Restoration Hardware',
      price: 495,
      location: ['Living Room', 'Corner'],
      category: ['Lighting'],
      images: [],
      description: 'Vintage industrial style floor lamp'
    });
    console.log(`   ✅ Added: ${product3.product_name}\n`);
    
    // List products
    console.log('3️⃣ Listing all products:');
    const products = await manager.getProducts();
    products.forEach(p => {
      console.log(`   • ${p.product_name} - $${p.price} (${p.category.join(', ')})`);
    });
    
    // Show categories and locations
    console.log('\n4️⃣ Categories found:');
    const categories = await manager.getCategories();
    categories.forEach(c => console.log(`   • ${c.name}`));
    
    console.log('\n5️⃣ Locations found:');
    const locations = await manager.getLocations();
    locations.forEach(l => console.log(`   • ${l.name}`));
    
    // Project info
    console.log('\n6️⃣ Project Summary:');
    console.log(`   📁 Location: ${demoPath}`);
    console.log(`   📦 Products: ${products.length}`);
    console.log(`   📂 Categories: ${categories.length}`);
    console.log(`   📍 Locations: ${locations.length}`);
    
    // Close
    await manager.closeProject();
    console.log('\n✅ Demo complete! Project saved at:');
    console.log(`   ${demoPath}`);
    console.log('\n💡 You can now:');
    console.log('   • Open this project in Finder/Explorer');
    console.log('   • Browse the SQLite database with a viewer');
    console.log('   • Re-open it with the interactive test');
    console.log('   • Use it in your Electron app');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

quickDemo().catch(console.error);