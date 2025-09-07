import { Project, Product } from '../types';

// Helper function to generate random date within last year
const randomDate = (start: Date, end: Date): Date => {
  return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
};

// Product name prefixes and suffixes for variety
const productPrefixes = [
  'Premium', 'Professional', 'Heavy-Duty', 'Eco-Friendly', 'Smart',
  'Industrial', 'Commercial', 'Residential', 'Deluxe', 'Standard',
  'Advanced', 'Basic', 'Elite', 'Pro Series', 'Classic'
];

const productTypes = [
  'LED Panel Light', 'Ceiling Fan', 'Track Lighting', 'Pendant Light', 'Wall Sconce',
  'Kitchen Faucet', 'Bathroom Sink', 'Shower Head', 'Toilet', 'Bathtub',
  'Circuit Breaker', 'Outlet', 'Switch', 'Wire', 'Junction Box',
  'Hardwood Flooring', 'Tile', 'Carpet', 'Vinyl Plank', 'Laminate',
  'Window', 'Door', 'Door Handle', 'Lock Set', 'Hinge',
  'Air Conditioner', 'Furnace', 'Thermostat', 'Duct', 'Vent',
  'Insulation Roll', 'Foam Board', 'Spray Foam', 'Vapor Barrier', 'Weather Strip',
  'Shingle', 'Metal Roofing', 'Gutter', 'Downspout', 'Flashing',
  'Cabinet', 'Drawer', 'Shelf', 'Storage Unit', 'Organizer',
  'Granite Countertop', 'Quartz Surface', 'Marble Slab', 'Butcher Block', 'Laminate Top',
  'Faucet', 'Handle', 'Knob', 'Pull', 'Hinge',
  'Lumber', 'Plywood', 'Drywall', 'Cement', 'Brick',
  'Refrigerator', 'Dishwasher', 'Range', 'Microwave', 'Washer',
  'Paint', 'Primer', 'Stain', 'Sealant', 'Varnish'
];

const manufacturers = [
  'Acme Corp', 'BuildPro Industries', 'QualityFirst', 'TechBuilder', 'ModernDesign',
  'ProBuild Solutions', 'Superior Materials', 'Atlas Manufacturing', 'Pinnacle Products',
  'Elite Builders Supply', 'Fortress Industries', 'Diamond Grade', 'Titan Tools',
  'Apex Materials', 'Sterling Products', 'Nova Industries', 'Quantum Build',
  'Phoenix Manufacturing', 'Vanguard Supply', 'Premier Products'
];

const locations = [
  'Main Warehouse', 'Storage Room A', 'Storage Room B', 'North Wing',
  'South Wing', 'East Section', 'West Section', 'Upper Level',
  'Lower Level', 'Mezzanine', 'Showroom', 'Display Area',
  'Loading Dock', 'Receiving Area', 'Quality Control', 'Testing Lab',
  'Assembly Area', 'Packaging Station', 'Shipping Department', 'Returns Section'
];

const categories = [
  'Lighting', 'Plumbing', 'Electrical', 'Flooring', 'Windows & Doors',
  'HVAC', 'Insulation', 'Roofing', 'Cabinets & Storage', 'Countertops',
  'Fixtures & Hardware', 'Building Materials', 'Appliances', 'Painting & Finishes',
  'Tools & Equipment', 'Safety Equipment', 'Fasteners', 'Adhesives & Sealants',
  'Outdoor & Garden', 'Smart Home'
];

// Generate tag IDs
const generateTagId = (projectIndex: number, productIndex: number): string => {
  const prefix = ['TRM', 'PRD', 'ITM'][projectIndex];
  return `${prefix}-${String(productIndex + 1).padStart(4, '0')}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`;
};

// Generate product URL
const generateProductUrl = (manufacturer: string, productName: string): string => {
  const cleanManufacturer = manufacturer.toLowerCase().replace(/\s+/g, '-');
  const cleanProduct = productName.toLowerCase().replace(/\s+/g, '-');
  return `https://www.${cleanManufacturer}.com/products/${cleanProduct}-${Math.floor(Math.random() * 9999)}`;
};

// Generate a single product
const generateProduct = (projectId: string, projectIndex: number, productIndex: number): Product => {
  const productType = productTypes[Math.floor(Math.random() * productTypes.length)];
  const prefix = productPrefixes[Math.floor(Math.random() * productPrefixes.length)];
  const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
  const productName = `${prefix} ${productType}`;
  
  // Random number of locations (1-3)
  const numLocations = Math.floor(Math.random() * 3) + 1;
  const productLocations = Array.from(
    { length: numLocations }, 
    () => locations[Math.floor(Math.random() * locations.length)]
  ).filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates
  
  // Single category (string, not array)
  const productCategory = categories[Math.floor(Math.random() * categories.length)];
  
  const basePrice = Math.floor(Math.random() * 2000) + 50; // $50 - $2050
  const imageId = Math.floor(Math.random() * 1000);
  
  const createdDate = randomDate(new Date(2024, 0, 1), new Date());
  const updatedDate = randomDate(createdDate, new Date());
  
  return {
    id: `${projectId}-product-${productIndex}`,
    projectId,
    url: generateProductUrl(manufacturer, productName),
    tagId: generateTagId(projectIndex, productIndex),
    location: productLocations,
    image: `https://picsum.photos/400/300?random=${imageId}`,
    images: [
      `https://picsum.photos/400/300?random=${imageId}`,
      `https://picsum.photos/400/300?random=${imageId + 1}`,
      `https://picsum.photos/400/300?random=${imageId + 2}`,
      `https://picsum.photos/400/300?random=${imageId + 3}`,
    ],
    description: `${productName} - High-quality ${productType.toLowerCase()} designed for professional and residential use. Features durable construction and modern design suitable for various applications.`,
    specificationDescription: `
      Model: ${prefix.toUpperCase()}-${Math.floor(Math.random() * 9999)}
      Dimensions: ${Math.floor(Math.random() * 48) + 12}" x ${Math.floor(Math.random() * 36) + 6}" x ${Math.floor(Math.random() * 24) + 2}"
      Weight: ${Math.floor(Math.random() * 50) + 5} lbs
      Material: High-grade materials with weather-resistant coating
      Warranty: ${Math.floor(Math.random() * 5) + 1} years manufacturer warranty
      Compliance: Meets all industry standards and regulations
      Installation: Professional installation recommended
    `.trim(),
    category: productCategory, // Single string instead of joined array
    product_name: productName,
    manufacturer, // Single string instead of array
    price: basePrice,
    custom_image_url: Math.random() > 0.7 ? `https://picsum.photos/400/300?random=${imageId + 10}` : undefined,
    createdAt: createdDate,
    updatedAt: updatedDate
  };
};

// Generate projects with products
export const generateMockProjects = (): Project[] => {
  const projects: Project[] = [
    {
      id: 'project-1',
      name: 'The Ranch Mine - Main Residence',
      description: 'Complete renovation and furnishing of the main residential building, including all interior fixtures, appliances, and structural elements.',
      status: 'active',
      createdAt: new Date('2024-01-15'),
      updatedAt: new Date('2024-12-10'),
      productCount: 100
    },
    {
      id: 'project-2', 
      name: 'The Ranch Mine - Guest Houses',
      description: 'Construction and outfitting of three guest houses with modern amenities, sustainable materials, and smart home integration.',
      status: 'active',
      createdAt: new Date('2024-03-20'),
      updatedAt: new Date('2024-12-08'),
      productCount: 100
    },
    {
      id: 'project-3',
      name: 'The Ranch Mine - Outdoor & Landscape',
      description: 'Comprehensive outdoor development including pool area, gardens, pathways, lighting, and recreational facilities.',
      status: 'planning',
      createdAt: new Date('2024-06-01'),
      updatedAt: new Date('2024-12-05'),
      productCount: 100
    }
  ];
  
  return projects;
};

// Generate all products for all projects
export const generateMockProducts = (): Product[] => {
  const projects = generateMockProjects();
  const allProducts: Product[] = [];
  
  projects.forEach((project, projectIndex) => {
    for (let i = 0; i < 100; i++) {
      allProducts.push(generateProduct(project.id, projectIndex, i));
    }
  });
  
  return allProducts;
};

// Export individual arrays for direct use
export const mockProjects = generateMockProjects();
export const mockProducts = generateMockProducts();

// Helper function to get products by project
export const getProductsByProject = (projectId: string): Product[] => {
  return mockProducts.filter(product => product.projectId === projectId);
};

// Helper function to get product statistics
export const getProjectStatistics = (projectId: string) => {
  const products = getProductsByProject(projectId);
  
  const stats = {
    totalProducts: products.length,
    totalValue: products.reduce((sum, p) => sum + (p.price || 0), 0),
    averagePrice: 0,
    categoryCounts: {} as Record<string, number>,
    manufacturerCounts: {} as Record<string, number>,
    locationCounts: {} as Record<string, number>
  };
  
  stats.averagePrice = stats.totalValue / stats.totalProducts;
  
  products.forEach(product => {
    // Count categories - handle both string and array formats
    const cats = Array.isArray(product.category) 
      ? product.category 
      : product.category.split(', ');
    cats.forEach((cat: string) => {
      stats.categoryCounts[cat] = (stats.categoryCounts[cat] || 0) + 1;
    });
    
    // Count manufacturers
    if (product.manufacturer) {
      stats.manufacturerCounts[product.manufacturer] = 
        (stats.manufacturerCounts[product.manufacturer] || 0) + 1;
    }
    
    // Count locations
    product.location.forEach(loc => {
      stats.locationCounts[loc] = (stats.locationCounts[loc] || 0) + 1;
    });
  });
  
  return stats;
};