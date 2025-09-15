// Database column names to TypeScript interface field names
export const DB_TO_INTERFACE_MAPPING = {
  // Asset management fields (snake_case -> camelCase)
  'primary_image_hash': 'primaryImageHash',
  'primary_thumbnail_hash': 'primaryThumbnailHash', 
  'additional_images_hashes': 'additionalImagesHashes',
  
  // Core fields (snake_case -> camelCase)
  'project_id': 'projectId',
  'tag_id': 'tagId',
  'specification_description': 'specificationDescription',
  'created_at': 'createdAt',
  'updated_at': 'updatedAt',
  'product_name': 'productName',
  
  // Fields that stay the same
  'id': 'id',
  'url': 'url',
  'location': 'location',
  'description': 'description', 
  'category': 'category',
  'manufacturer': 'manufacturer',
  'price': 'price'
} as const;

// Reverse mapping for updates
export const INTERFACE_TO_DB_MAPPING = Object.fromEntries(
  Object.entries(DB_TO_INTERFACE_MAPPING).map(([k, v]) => [v, k])
) as Record<string, string>;

// Type-safe field transformer
export function mapDbRowToInterface<T extends Record<string, any>>(
  dbRow: T
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [dbField, value] of Object.entries(dbRow)) {
    const interfaceField = DB_TO_INTERFACE_MAPPING[dbField as keyof typeof DB_TO_INTERFACE_MAPPING] || dbField;
    result[interfaceField] = value;
  }
  
  return result;
}

export function mapInterfaceToDb<T extends Record<string, any>>(
  interfaceObj: T
): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [interfaceField, value] of Object.entries(interfaceObj)) {
    const dbField = INTERFACE_TO_DB_MAPPING[interfaceField] || interfaceField;
    result[dbField] = value;
  }
  
  return result;
}