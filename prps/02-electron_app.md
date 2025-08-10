# TASK

Build an Electron app that allows a user to manage and scrape product information for an architectural project.

## Product Requirements

1. 1. The <HomePage> page of the application should have a persistent vertical sidebar with the following icons for
   2. Projects -> <ProjectPage>
   3. Settings -> <SettingsPage>
2. The <HomePage> page of the application should have a dropdown to select a project
3. If no projects exist, the <Home> page should have the user create their first project
4. A project is created by supplying a unique project_name
5. The <ProjectPage> page should
   1. List each project
   2. List number of products for each project
   3. Allow user to edit the name of each project
   4. Include a button to go back to the <Home> page
6. Once a project is selected, the <Home> page should include a button to "Add a product" which takes you to the <ProductNew> view
7. The <ProductNew> includes:
   1. input field for a "product_url"
   2. input field for "tag_id"
   3. input field for "product_location"
   4. button for "fetch product details"
8. On clicking the button to "fetch product details," the application hits an api with the product_url, tag_id, and product_location data
   1. For now, the api should be mocked, do not include a real request call
   2. The api returns
      1. product_image: string
      2. product_images: []string
      3. product_description: string
      4. specification_description: string
      5. category: string
9. The fetched fields should autofill and be editable in the input fields
10. An "Add Product" button should hit an api to save the final edited fields 
    1. Use a mock api for now


## UI Requirements:
1. Use React Router to navigate between views
2. Use React hooks for all state and context management
3. On API Errors, show a toaster with the api error message

## Technical Requirements
- React 19.1
- TypeScript
- Vite builder
- Hot reload in Dev
- CSS global stylesheet
- Electron Builder for packaging
- Package for Mac/Windows

## EXAMPLES


## DOCUMENTATION

## OTHER CONSIDERATIONS





  