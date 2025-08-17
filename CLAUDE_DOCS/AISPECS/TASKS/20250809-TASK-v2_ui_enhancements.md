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
10. Add column visibility toggle
11. Add simple filter by column values

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

### Subtask 3: Change category input to a dropdown with the ability to add additional dropdown options

**Description** 
When adding a new product, after fetching product details, there is a category input field which is an editable text field.
This field should instead be a dropdown field with options populated from a backend api call with the option to add a new category.


**Requirements**
- Review and re-use the same pattern for selecting the Product Location
- The current implementation should mock the api call and return a list of mock product categories relating to a residential architectural project product
- Adding a new category should use the api to persist the category option
  - Right now, implement a mock api POST call
- Only one category should be selected per product

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
As a user, when adding a new product, after fetching the product details, I should be able to select multiple locations
via the `Product Location` dropdown selection input. As of now, I can only select one option.

The API specification should update to allow multiple locations per product.

**Requirements**
- Allow multiple `Product Location` selections during the "Add a new product" workflow
- Display all selected product locations in the product description in the product page
- When viewing the products in the table view in the ProjectPage, the product should show all locations, but should only show as one line item
- When grouping products by location in the table view in the ProjectPage, the product should show in all product groups it's related to
- Update data model for many-to-many relationship
- Update any existing database schemas for location relationships

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
As a user, when clicking on a product to view, I should see the Product Name at the top of the ProductPage.
The title/header of the ProductPage should be the product name and not the product description.

**Requirements**
- Display the product name at the top of the ProductPage
- Display the product name in the product description

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
As a user, I should be able to edit/save any of the product fields in the ProductPage view.

**Requirements**
- Add a pencil edit icon to each of the following sections in the ProducePage view
  - Product Information
  - Description
  - Specifications
- When clicking the pencil icon, render two new buttons for "Cancel" and "Save"
  - Make each field editable according to it's type
  - Category should remain a selectable dropdown with the ability to add a category like in the "Add a New Product" workflow
    - re-use the same components during product extraction
  - The Location select component should also be re-used from product extraction and should
    - Allow multi-selection
    - Ability to add a new location
  - Descriptions and Specification should remain text fields
- The current subheader which displays the product description should not be editable but should update when the Description block is edited

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
As a user, I should be able to upload and remove an image in the product page view.

The ProductPage currently has two image views.

1. Product Image
   1. The core/primary product image
2. Additional Images
   1. Any additional/supporting/alternative product images

**Requirements**
- When hovering on a product image in the ProductPage view, render a grey circle with a black 'X' button in the top right corner of the image
  - If the 'X' button is selected, remove the image from the view and render a 'Cancel' and 'Save' button above the image and Product Information views (but below the header/subheader)
  - If the user hits the 'Save' button, remove the image from persistence/memory
  - If the user hits 'Cancel' revert all changes
- If no Product Image exists, show a skeleton frame for as an image placeholder
- If no Additional Images exist, show only a single skeleton frame as an image placeholder
- Render a title above the main product image called "Product Image"
- To the right of the product image headers, "Product Image" and "Additional Images", show an upload icon
  - Clicking the upload icon should allow the user to upload an image from local filesystem
  - On uploading the image, render it to view, but do not save/persist the changes/upload until the user hits the 'Save' button
- Right now use mock apis and save to filesystem for any image upload/deletions
  - Right the code using interfaces so that in the future we can swap them out to call backend APIs to take care of persistence

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
As a user, I should be able to group the product table in the ProjectPage by category, location, manufacturer, 

**Requirements**
- Add additional group-by options to the Group By dropdown in the ProjectPage for category, location, and manufacturer

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
As a user, I should be able to sort by any of the table columns.

**Requirements**
- Next to each table column header in the ProductPage view, add a sort up/down icon that is clickable
- Allow only one sort at a time 
- Do not allow sort on 'Image' or 'Actions'

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

### Subtask 10: Add column visibility toggle

**Description** 
As a user, I should be able to select which columns I want to render on the table view

**Requirements**
- Create a dropdown that allows a user to select which columns to render in the table
- Do not allow the 'Actions' column to be an option
- Persist column preferences per user/session
- Default to showing all columns initially

**Task Delegation Analysis**

1. **Overall vision:** Give users control over table layout by choosing which columns to display, optimizing screen space and focus.

2. **Bits of work needed:**
   - Column selector UI component (dropdown with checkboxes)
   - State management for column visibility
   - Persistence of preferences
   - Responsive behavior for mobile views
   - Default column configuration

3. **Human expertise needed:**
   - Define default visible columns
   - Design column selector UI pattern
   - Determine persistence strategy (local storage vs backend)

4. **AI capabilities needed:**
   - Implement column visibility toggle logic
   - Create UI component for column selection
   - Handle state persistence
   - Update table rendering logic

5. **Collaboration impact:**
   - Establishing default column sets
   - Designing intuitive toggle interface
   - Determining mobile vs desktop defaults

### Subtask 11: Add simple filter by column values

**Description**
As a user, I should be able to filter the product table rows based on column values to find specific products quickly.

**Requirements**
- Add filter inputs for each filterable column (text fields for string columns, dropdowns for categorical data)
- Support basic filter operations (contains, equals, starts with)
- Allow multiple filters to be active simultaneously (AND logic)
- Add clear/reset all filters button
- Exclude 'Image' and 'Actions' columns from filtering

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

---

## SMART Analysis

### Subtask 1: Add ability to upload custom image during product fetch
- **Specific:** ✅ Clear requirement to add image upload during product creation
- **Measurable:** ✅ Support JPG/PNG/WebP, max 5MB file size
- **Achievable:** ✅ Standard feature, realistic with file upload libraries
- **Relevant:** ✅ Directly addresses image accuracy issues
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Add estimated time (e.g., "Complete within sprint 1")

### Subtask 2: Add missing data fields to table column and product details
- **Specific:** ✅ Add product_name, manufacturer, price fields
- **Measurable:** ✅ Fields should be visible in table, product creation, and detail views
- **Achievable:** ✅ Database and UI updates are straightforward
- **Relevant:** ✅ Essential product information
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Define completion milestone

### Subtask 3: Change category input to dropdown with ability to add options
- **Specific:** ✅ Convert text field to dropdown with add-new capability
- **Measurable:** ✅ Mock API calls specified, single selection constraint
- **Achievable:** ✅ Pattern already exists for Product Location
- **Relevant:** ✅ Improves data consistency
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Add timeline for implementation

### Subtask 4: Change location to multi-select
- **Specific:** ✅ Enable multiple location selection and proper group-by behavior
- **Measurable:** ✅ Display requirements and data model changes defined
- **Achievable:** ✅ Standard many-to-many relationship
- **Relevant:** ✅ Supports products in multiple locations
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Specify migration deadline for existing data

### Subtask 5: Change product detail title to product name
- **Specific:** ✅ Use product_name instead of description for title
- **Measurable:** ✅ Title should appear at top of ProductPage
- **Achievable:** ✅ Simple UI change
- **Relevant:** ✅ Improves readability and navigation
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Quick win - could be done immediately

### Subtask 6: Change product details fields to be editable
- **Specific:** ✅ Detailed edit mode requirements with pencil icon, save/cancel
- **Measurable:** ✅ Specific sections and field behaviors defined
- **Achievable:** ✅ Component reuse specified
- **Relevant:** ✅ Reduces navigation for edits
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Add phased delivery timeline

### Subtask 7: Add ability to remove or upload image in product page
- **Specific:** ✅ Detailed UI behaviors for image management
- **Measurable:** ✅ Hover effects, button placements, mock API specified
- **Achievable:** ✅ Mock implementation with future API swap
- **Relevant:** ✅ Complete image management capability
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Coordinate with Subtask 1 timeline

### Subtask 8: Add group-by any column
- **Specific:** ✅ Group by category, location, manufacturer
- **Measurable:** ✅ Additional dropdown options required
- **Achievable:** ✅ Extension of existing group-by functionality
- **Relevant:** ✅ Enhances data analysis
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Define performance benchmarks for large datasets

### Subtask 9: Add sort-by any column
- **Specific:** ✅ Sort icons on headers, single sort at a time
- **Measurable:** ✅ Exclude Image and Actions columns
- **Achievable:** ✅ Standard table sorting feature
- **Relevant:** ✅ Essential for data navigation
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Add completion target

### Subtask 10: Add column visibility toggle
- **Specific:** ✅ Clear requirement for column show/hide functionality
- **Measurable:** ✅ Dropdown for column selection, exclude Actions, persist preferences
- **Achievable:** ✅ Standard table feature, straightforward implementation
- **Relevant:** ✅ Helps users focus on relevant data columns
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Add timeline for implementation

### Subtask 11: Add simple filter by column values
- **Specific:** ✅ Filter rows based on column values with clear operations
- **Measurable:** ✅ Filter inputs per column, AND logic, clear button specified
- **Achievable:** ✅ Standard filtering feature with defined scope
- **Relevant:** ✅ Essential for finding specific products quickly
- **Time-bound:** ❌ No deadline specified
- **Recommendation:** Add timeline, consider phasing with Subtask 10

### Overall SMART Assessment
**Strengths:**
- Requirements are generally specific and measurable
- All tasks are technically achievable
- Strong relevance to user needs
- Now have 11 well-defined subtasks (after splitting filtering/visibility)

**Updates Completed:**
- ✅ **Priority:** All tasks marked as P1 (equal importance)
- ✅ **Dependencies:** Subtask 2 must complete before Subtasks 8 & 9
- ✅ **Clarification:** Subtask 10 split into column visibility (10) and value filtering (11)
- ✅ **Phased Delivery:** 5 phases identified based on dependencies and logical grouping

**Remaining Gap:**
- **No Time-bounds:** Deferred per user preference

**Recommended Phases:**
1. **Foundation:** Subtasks 2, 5 (data fields & title fix)
2. **Data Organization:** Subtasks 8, 9, 10, 11 (group, sort, filter, visibility)
3. **Enhanced Input:** Subtasks 3, 4 (dropdowns & multi-select)
4. **Edit Capabilities:** Subtask 6 (inline editing)
5. **Image Management:** Subtasks 1, 7 (upload functionality)