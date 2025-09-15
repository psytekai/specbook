// API field names to internal TypeScript interface field names
export const API_TO_INTERNAL_MAPPING = {
  // URL and identification
  'productUrl': 'url',
  'tagId': 'tagId',
  'projectId': 'projectId',
  
  // Content fields
  'productLocation': 'location',
  'productDescription': 'description',
  'specificationDescription': 'specificationDescription',
  'productName': 'productName',
  
  // Asset management fields (corrected)
  'primaryImageHash': 'primaryImageHash',
  'primaryThumbnailHash': 'primaryThumbnailHash',
  'additionalImagesHashes': 'additionalImagesHashes',
  
  // Legacy/deprecated fields
  'customImageUrl': null,     // Deprecated
  'productImage': null,         // Deprecated
  'productImages': null,        // Deprecated
  'imageHash': 'primaryImageHash',     // Legacy redirect
  'thumbnailHash': 'primaryThumbnailHash', // Legacy redirect
  'imagesHashes': 'additionalImagesHashes' // Legacy redirect
} as const;

export function transformApiToInternal(apiData: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [apiField, value] of Object.entries(apiData)) {
    const mapping = API_TO_INTERNAL_MAPPING[apiField as keyof typeof API_TO_INTERNAL_MAPPING];
    
    if (mapping === null) {
      console.warn(`Deprecated API field ignored: ${apiField}`);
      continue;
    }
    
    const internalField = mapping || apiField;
    result[internalField] = value;
  }
  
  return result;
}

export function transformInternalToApi(internalData: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  
  // Reverse mapping for API responses
  const reverseMapping: Record<string, string> = {
    'url': 'productUrl',
    'tagId': 'tagId',
    'projectId': 'projectId',
    'location': 'productLocation',
    'description': 'productDescription',
    'specificationDescription': 'specificationDescription',
    'productName': 'productName',
    'primaryImageHash': 'primaryImageHash',
    'primaryThumbnailHash': 'primaryThumbnailHash',
    'additionalImagesHashes': 'additionalImagesHashes'
  };
  
  for (const [internalField, value] of Object.entries(internalData)) {
    const apiField = reverseMapping[internalField] || internalField;
    result[apiField] = value;
  }
  
  return result;
}