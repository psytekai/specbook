# Execution Brief for UI Enhancements

## Subtask 1: Add ability to upload custom image during product fetch
**Inputs:**  
- Existing product creation flow UI
- Product data model/schema
- File system or cloud storage access

**Outputs:**  
- File upload component with drag-and-drop
- Updated product model with custom_image_url field
- Image validation (JPG/PNG/WebP, max 5MB)
- Mock API endpoint for image uploads

**Constraints:**  
- Max file size: 5MB
- Supported formats: JPG, PNG, WebP only
- Must integrate seamlessly with existing product fetch flow
- Use mock filesystem storage for now

**Plan:**  
1. Add custom_image_url field to product model
2. Create FileUpload React component with drag-and-drop
3. Implement client-side validation for format and size
4. Add upload zone after product fetch, before save
5. Create mock API endpoint that saves to filesystem
6. Update product save logic to include custom image URL
7. Display uploaded image preview with remove option

## Subtask 2: Add missing data fields to table and product details
**Inputs:**  
- Current product model
- LLM extraction prompts
- Product table component
- Product detail view component

**Outputs:**  
- Updated product model with product_name, manufacturer, price fields
- Modified LLM prompts to extract these fields
- Enhanced table with new columns
- Updated product detail view
- Editable form fields in product creation

**Constraints:**  
- Must handle missing/null values gracefully
- Price needs currency formatting
- Fields must be editable during product creation
- Preserve existing data during migration

**Plan:**  
1. Update product model/schema with new fields
2. Modify LLM prompts in prompt_templator.py to extract product_name, manufacturer, price
3. Add columns to ProjectPage table component
4. Update AddProduct form to show editable fields
5. Modify ProductPage to display new fields
6. Implement price formatting utility
7. Create data migration for existing products

## Subtask 3: Change category input to dropdown with add option
**Inputs:**  
- Current category text input field
- Product Location dropdown pattern
- Product creation form

**Outputs:**  
- Category dropdown component with "Add new" option
- Mock API for category CRUD operations
- Category persistence logic
- Updated product creation flow

**Constraints:**  
- Single category selection only
- Reuse Product Location dropdown pattern
- Mock categories should relate to residential architecture
- Must persist new categories for future use

**Plan:**  
1. Create mock categories list (Lighting, Plumbing, Electrical, etc.)
2. Copy Product Location dropdown component pattern
3. Add "Add new category" option to dropdown
4. Implement modal/inline input for new category
5. Create mock API endpoints (GET /categories, POST /categories)
6. Update product model to use category ID reference
7. Migrate existing text categories to dropdown options

## Subtask 4: Change location to multi-select
**Inputs:**  
- Current single-select location dropdown
- Product model with location field
- Group-by logic in table view

**Outputs:**  
- Multi-select location component
- Updated product model for many-to-many relationship
- Modified group-by algorithm
- Updated product display logic

**Constraints:**  
- Must show product in all selected locations
- When grouped, product appears in each relevant group
- Table shows all locations in single row when not grouped
- Maintain backward compatibility with existing data

**Plan:**  
1. Convert location field to array in product model
2. Update location dropdown to multi-select component
3. Modify product save logic to handle location array
4. Update table display to show comma-separated locations
5. Refactor group-by logic to duplicate products across groups
6. Update product detail view to show all locations
7. Migrate existing single locations to arrays

## Subtask 5: Change product detail title to product name
**Inputs:**  
- Current ProductPage component
- Product data with description and name fields

**Outputs:**  
- Updated ProductPage with product_name as title
- Fallback logic for missing names

**Constraints:**  
- Must handle null/empty product names
- Keep description in body content
- Update any breadcrumbs/navigation

**Plan:**  
1. Locate title display in ProductPage component
2. Change from product.description to product.product_name
3. Implement fallback: product_name || description || "Untitled Product"
4. Keep description in product details section
5. Update page metadata/title tag
6. Test with various data scenarios

## Subtask 6: Make product details editable in product page
**Inputs:**  
- ProductPage component
- All product field types
- Category and Location dropdowns from previous tasks

**Outputs:**  
- Edit mode for Product Information, Description, Specifications
- Pencil edit icons for each section
- Save/Cancel buttons
- Field validation logic
- Optimistic updates

**Constraints:**  
- Reuse dropdown components from product creation
- Category remains single-select
- Location allows multi-select with add option
- Subheader description updates but isn't directly editable

**Plan:**  
1. Add edit state management to ProductPage
2. Create EditableSection wrapper component with pencil icon
3. Implement toggleEdit function for each section
4. Convert display fields to inputs when editing
5. Reuse CategoryDropdown and LocationMultiSelect components
6. Add Save/Cancel button bar when editing
7. Implement field validation
8. Create API calls for updating product
9. Add optimistic updates with rollback on error

## Subtask 7: Add image management in product page
**Inputs:**  
- ProductPage component
- Image upload component from Subtask 1
- Product image data

**Outputs:**  
- Delete functionality for images (X button on hover)
- Upload icons for main and additional images
- Skeleton placeholders for missing images
- Save/Cancel controls for image changes
- Mock API for image operations

**Constraints:**  
- Use grey circle with black X for delete
- Changes not persisted until Save clicked
- Mock APIs save to filesystem
- Code must use interfaces for future API swap

**Plan:**  
1. Add hover state to product images with X button overlay
2. Implement image deletion with staging (not immediate)
3. Add skeleton frame components for empty images
4. Add "Product Image" and "Additional Images" headers
5. Place upload icons next to headers
6. Reuse FileUpload component from Subtask 1
7. Add Save/Cancel buttons when images modified
8. Create ImageService interface for operations
9. Implement MockImageService with filesystem storage
10. Stage all changes until Save is clicked

## Subtask 8: Add group-by for category, location, manufacturer
**Inputs:**  
- Current group-by dropdown
- Product table component
- Products with new fields from Subtask 2

**Outputs:**  
- Extended group-by dropdown options
- Dynamic grouping algorithm
- Expandable group headers
- Aggregate calculations per group

**Constraints:**  
- Depends on Subtask 2 completion (new fields)
- Must handle multi-location products appearing in multiple groups
- Performance optimization for large datasets

**Plan:**  
1. Add category, location, manufacturer to group-by dropdown
2. Create generic grouping algorithm accepting any field
3. Implement group header component with count
4. Add expand/collapse functionality
5. Handle multi-location special case (duplicate in groups)
6. Calculate aggregates (count, total price) per group
7. Add "Ungrouped" section for null values
8. Optimize with useMemo for large datasets

## Subtask 9: Add sort-by any column
**Inputs:**  
- Product table headers
- Table data array
- Column definitions

**Outputs:**  
- Clickable sort icons on each column header
- Sort direction indicators (up/down arrows)
- Sorting algorithm for different data types
- Sort state management

**Constraints:**  
- Single column sort only
- Exclude Image and Actions columns
- Must handle null/undefined values
- Preserve selection/other states during sort

**Plan:**  
1. Add sort icons to table headers (except Image, Actions)
2. Implement sort state (column, direction)
3. Create onClick handlers for headers
4. Build sorting function with type detection
5. Handle null/undefined values (sort to end)
6. Add visual feedback for active sort
7. Reset sort when switching columns
8. Maintain row selection during sort

## Subtask 10: Add column visibility toggle
**Inputs:**  
- Table column definitions
- Current table display logic
- User preferences storage

**Outputs:**  
- Column selector dropdown with checkboxes
- Updated table rendering based on selection
- Persisted column preferences
- Responsive defaults

**Constraints:**  
- Actions column cannot be hidden
- Default to all columns visible
- Persist preferences in localStorage
- Different defaults for mobile vs desktop

**Plan:**  
1. Create ColumnSelector dropdown component
2. Add checkbox for each column (except Actions)
3. Implement visibility state management
4. Filter displayed columns based on selection
5. Save preferences to localStorage
6. Load preferences on mount
7. Add "Reset to default" option
8. Implement responsive defaults (hide some on mobile)

## Subtask 11: Add simple filter by column values
**Inputs:**  
- Table data and column definitions
- Filter UI patterns
- Current table display

**Outputs:**  
- Filter inputs per column (text/dropdown based on type)
- Multi-filter combination with AND logic
- Clear all filters button
- Filtered data display

**Constraints:**  
- Exclude Image and Actions columns from filtering
- Support contains/equals/starts with operations
- Must handle performance for large datasets
- Preserve other table states (sort, grouping)

**Plan:**  
1. Add filter row below headers
2. Create FilterInput component (text for strings, dropdown for enums)
3. Implement filter state as object {column: value}
4. Build filtering algorithm with AND logic
5. Add operation selector (contains/equals/starts with)
6. Create "Clear all" button
7. Apply filters before grouping/sorting
8. Optimize with useMemo for performance
9. Show active filter count indicator
10. Persist filter state in URL params (optional)