# Task: UI Enhancements

## Subtasks
 
1. Add ability to upload custom image during product fetch to allow image correction on bad scrape
2. Add missing data fields to table column and product details: product name, manufacturer, price
3. Change category input to a dropdown with ability to add additional dropdown options
4. Change location to be a multi-select and render product across all locations during a group-by
5. Change product detail title to be product name and not product description
6. Change product details fields to be editable in product page views
7. Add ability to remove or upload image in product page view
8. Add group-by any column
9. Add sort-by any column
10. Add simple filter [by column value]

### Subtask 1: Add ability to upload custom image during product fetch

**Description** 
When a user is adding a new product, they give the web app a product url, and the system fetches the product information, including a product image. The product image, for many reasons, may be wrong. So we want to allow the user to be able to upload an image before saving the new product.

**Requirements**
- Support JPG, PNG, WebP formats
- Max file size of 5MB
- Update product record to use custom image URL

**Task Delegation Analysis**

1. **Overall vision:** Enable users to correct incorrect product images by uploading their own during product creation, ensuring accurate product representation.

2. **Bits of work needed:**
   - File upload UI component with drag-and-drop support
   - Client-side image validation (format, size)
   - Image storage/hosting solution setup
   - API endpoint to handle image uploads
   - Update product model to support custom image URLs

3. **Human expertise needed:**
   - UX design decision: where in the flow should upload appear
   - Architecture decision: image storage strategy (local filesystem vs cloud storage like S3)
   - Visual design: upload states and error feedback

4. **AI capabilities needed:**
   - Implementation of file handling logic and validation
   - API endpoint creation with proper error handling
   - Integration with existing product fetch flow
   - Update database schema if needed

5. **Collaboration impact:**
   - Clarifying the UI/UX flow with stakeholders
   - Deciding on long-term image persistence strategy
   - Determining fallback behavior and error states

### Subtask 2: Add missing data fields to table column and product details

**Description** 
When fetching product information, the API should return product_name, manufacturer, and price. These fields should show as editable fields that are populated by the API when adding a new product.

**Requirements**
- When viewing a project, the product table should include columns for product_name, manufacturer, and price
- When adding a new product, these three fields should return from the api and be editable before saving a new product
- When viewing a product, these fields should show in the product description

**Task Delegation Analysis**

1. **Overall vision:** Enrich product data with essential commercial information (name, manufacturer, price) that users can view and edit throughout the application.

2. **Bits of work needed:**
   - Update scraping/API logic to extract these fields
   - Database schema updates for new fields
   - Table component updates to display new columns
   - Form fields in product creation flow
   - Product detail view updates

3. **Human expertise needed:**
   - Data extraction strategy for reliable field capture
   - Price formatting and currency decisions
   - Column priority and table layout optimization

4. **AI capabilities needed:**
   - Enhance LLM prompts to extract these specific fields
   - Database migration scripts
   - Component updates for display and editing
   - Form validation logic

5. **Collaboration impact:**
   - Confirming field formats and validation rules
   - Deciding on price display format and currency handling
   - Prioritizing column visibility on different screen sizes

### Subtask 3: Change category input to a dropdown with ability to add additional dropdown options

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Transform category selection from free text to a structured dropdown with dynamic option management, improving data consistency.

2. **Bits of work needed:**
   - Create dropdown component with "add new" option
   - Category management system (storage, CRUD operations)
   - Migration of existing category data
   - Validation and deduplication logic

3. **Human expertise needed:**
   - Define initial category list and hierarchy
   - Decide on category management permissions
   - Design the "add new category" workflow

4. **AI capabilities needed:**
   - Dropdown component implementation with search
   - Category persistence and management logic
   - Data migration script for existing categories

5. **Collaboration impact:**
   - Establishing standard category taxonomy
   - Deciding who can add new categories
   - Handling category merging/cleanup strategy

### Subtask 4: Change location to be a multi-select and render product across all locations during a group-by

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Enable products to exist in multiple locations simultaneously with proper visualization when grouping data.

2. **Bits of work needed:**
   - Multi-select location component
   - Update data model for many-to-many relationship
   - Modify group-by logic to handle multiple locations
   - Update visualization to show products across locations

3. **Human expertise needed:**
   - Define location structure and hierarchy
   - Decide on visual representation in grouped views
   - Determine location inheritance rules

4. **AI capabilities needed:**
   - Multi-select component with search/filter
   - Database schema updates for location relationships
   - Group-by algorithm modifications
   - UI updates for location display

5. **Collaboration impact:**
   - Clarifying business logic for multi-location products
   - Designing intuitive grouped view representation
   - Establishing location management strategy

### Subtask 5: Change product detail title to be product name and not product description

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Use concise product names as titles for better readability and navigation, keeping descriptions in the body content.

2. **Bits of work needed:**
   - Identify title display locations
   - Update component to use product_name field
   - Handle fallback for missing product names
   - Update any dependent navigation/breadcrumbs

3. **Human expertise needed:**
   - Define title truncation rules for long names
   - Decide on fallback hierarchy when name is missing
   - Determine SEO/accessibility implications

4. **AI capabilities needed:**
   - Component updates to reference correct field
   - Implement fallback logic
   - Update any affected test cases

5. **Collaboration impact:**
   - Confirming title display rules across views
   - Ensuring consistency with navigation patterns
   - Validating change doesn't break existing workflows

### Subtask 6: Change product details fields to be editable in product page views

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Enable inline editing of product information directly from the detail view, reducing navigation and improving user efficiency.

2. **Bits of work needed:**
   - Convert display fields to editable components
   - Add edit/save/cancel controls
   - Implement validation and error handling
   - Add optimistic updates with rollback
   - Create audit trail for changes

3. **Human expertise needed:**
   - Define which fields should be editable
   - Design edit mode UX (inline vs modal)
   - Establish validation rules and permissions

4. **AI capabilities needed:**
   - Implement editable field components
   - API endpoints for field updates
   - Validation and error handling logic
   - State management for edit modes

5. **Collaboration impact:**
   - Determining field-level permissions
   - Designing intuitive edit interactions
   - Establishing data validation standards

### Subtask 7: Add ability to remove or upload image in product page view

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Provide full image management capabilities within the product detail view, allowing users to update or remove images post-creation.

2. **Bits of work needed:**
   - Image upload component for detail view
   - Delete image functionality with confirmation
   - Image replacement logic
   - Thumbnail generation and display
   - Handle image history/versioning

3. **Human expertise needed:**
   - Define image deletion behavior (soft vs hard delete)
   - Design image management UI layout
   - Establish image versioning strategy

4. **AI capabilities needed:**
   - Image upload/delete API endpoints
   - UI components for image management
   - File cleanup and storage management
   - Update product state after image changes

5. **Collaboration impact:**
   - Confirming image retention policies
   - Designing user-friendly image management flow
   - Determining storage cleanup strategy

### Subtask 8: Add group-by any column

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Enable flexible data organization by allowing users to group products by any available column, improving data analysis capabilities.

2. **Bits of work needed:**
   - Dynamic group-by selector UI
   - Grouping algorithm for various data types
   - Aggregate calculations for grouped data
   - Expandable/collapsible group rendering
   - Performance optimization for large datasets

3. **Human expertise needed:**
   - Define groupable vs non-groupable columns
   - Design group header information display
   - Determine default aggregation functions

4. **AI capabilities needed:**
   - Implement dynamic grouping logic
   - Create flexible UI components
   - Optimize query performance
   - Handle edge cases for different data types

5. **Collaboration impact:**
   - Identifying key grouping use cases
   - Designing intuitive group navigation
   - Establishing performance thresholds

### Subtask 9: Add sort-by any column

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Provide comprehensive sorting capabilities on all columns to help users quickly find and organize their data.

2. **Bits of work needed:**
   - Sortable column headers with indicators
   - Multi-column sort support
   - Sort persistence and preferences
   - Custom sort logic for complex fields
   - Performance optimization for sorting

3. **Human expertise needed:**
   - Define sort priority for multi-column sorts
   - Design sort indicator UI patterns
   - Determine default sort behaviors

4. **AI capabilities needed:**
   - Implement sort algorithms for different data types
   - Add UI controls and indicators
   - Optimize database queries for sorting
   - Handle null/empty value sorting

5. **Collaboration impact:**
   - Establishing sort interaction patterns
   - Defining business-specific sort rules
   - Ensuring consistent sort behavior across views

### Subtask 10: Add simple filter [by column value]

**Description** 
[To be provided]

**Requirements**
- [To be provided]

**Task Delegation Analysis**

1. **Overall vision:** Enable users to quickly filter data by column values to focus on relevant products and reduce information overload.

2. **Bits of work needed:**
   - Filter UI components (dropdowns, text inputs, ranges)
   - Filter logic for different data types
   - Multi-filter combination logic (AND/OR)
   - Filter state management and persistence
   - Clear/reset filter functionality

3. **Human expertise needed:**
   - Define filter UI patterns per data type
   - Design filter combination logic
   - Establish filter persistence strategy

4. **AI capabilities needed:**
   - Implement filter components and logic
   - Create efficient filtering algorithms
   - Build filter state management
   - Optimize performance for large datasets

5. **Collaboration impact:**
   - Identifying common filter scenarios
   - Designing intuitive filter interfaces
   - Determining saved filter requirements