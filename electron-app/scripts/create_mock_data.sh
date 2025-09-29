#!/bin/bash

# Mock Data Generator for Specbook Project Database
# Usage: ./create_mock_data.sh <database_location> <num_of_products>
# Example: ./create_mock_data.sh ~/Desktop/New.specbook/project.db 100

set -e

# Default values
DATABASE_LOCATION="${1:-~/Desktop/New.specbook/project.db}"
NUM_PRODUCTS="${2:-100}"

# Expand tilde in path
DATABASE_LOCATION="${DATABASE_LOCATION/#\~/$HOME}"

# Fixed asset hash as requested
ASSET_HASH="9367a64f5dd6b7e741f54957136416374b6c662c9bd1094c95bff9790add3d72"

# Predefined categories (10)
CATEGORIES=(
    "Electronics"
    "Furniture"
    "Appliances"
    "Tools"
    "Lighting"
    "Hardware"
    "HVAC"
    "Plumbing"
    "Safety Equipment"
    "Outdoor Equipment"
)

# Predefined locations (10)
LOCATIONS=(
    "Warehouse A"
    "Warehouse B"
    "Storage Room 1"
    "Storage Room 2"
    "Main Floor"
    "Basement"
    "Loading Dock"
    "Office Storage"
    "Vendor Area"
    "Returns Section"
)

# Sample manufacturers
MANUFACTURERS=(
    "Acme Corp"
    "TechnoMax"
    "ProBuild"
    "Industrial Solutions"
    "QualityFirst"
    "MegaTech"
    "Precision Tools"
    "SafetyPro"
    "DuraMax"
    "EliteGear"
)

# Sample product types
PRODUCT_TYPES=(
    "Standard"
    "Premium"
    "Commercial"
    "Industrial"
    "Residential"
    "Professional"
    "Heavy Duty"
    "Lightweight"
    "Portable"
    "Stationary"
)

echo "Creating mock data for database: $DATABASE_LOCATION"
echo "Number of products to generate: $NUM_PRODUCTS"

# Check if database file exists
if [ ! -f "$DATABASE_LOCATION" ]; then
    echo "Error: Database file not found at $DATABASE_LOCATION"
    echo "Please ensure the database file exists and run migrations first."
    exit 1
fi

# Function to generate UUID (simplified version)
generate_uuid() {
    if command -v uuidgen >/dev/null 2>&1; then
        uuidgen | tr '[:upper:]' '[:lower:]'
    else
        # Fallback: generate pseudo-UUID
        printf '%08x-%04x-%04x-%04x-%012x\n' \
            $((RANDOM * RANDOM)) \
            $((RANDOM)) \
            $((RANDOM | 0x4000)) \
            $((RANDOM | 0x8000)) \
            $((RANDOM * RANDOM * RANDOM))
    fi
}

# Function to get random element from array
get_random_element() {
    local arr=("$@")
    local index=$((RANDOM % ${#arr[@]}))
    echo "${arr[$index]}"
}

# Function to generate random price
generate_price() {
    echo "scale=2; ($RANDOM % 99900 + 100) / 100" | bc -l
}

# Function to escape single quotes for SQL
escape_sql() {
    echo "$1" | sed "s/'/''/g"
}

echo "Analyzing database schema..."

# Get current schema version
SCHEMA_VERSION=$(sqlite3 "$DATABASE_LOCATION" "SELECT MAX(version) FROM schema_version;" 2>/dev/null || echo "0")
echo "Current schema version: $SCHEMA_VERSION"

# Verify table structure
echo "Verifying table structures..."
sqlite3 "$DATABASE_LOCATION" ".schema products" >/dev/null 2>&1 || {
    echo "Error: Products table not found. Please run migrations first."
    exit 1
}

sqlite3 "$DATABASE_LOCATION" ".schema categories" >/dev/null 2>&1 || {
    echo "Error: Categories table not found. Please run migrations first."
    exit 1
}

sqlite3 "$DATABASE_LOCATION" ".schema locations" >/dev/null 2>&1 || {
    echo "Error: Locations table not found. Please run migrations first."
    exit 1
}

echo "Creating categories..."

# Clear existing data (optional - comment out if you want to preserve existing data)
echo "Clearing existing mock data..."
sqlite3 "$DATABASE_LOCATION" "DELETE FROM products WHERE tag_id LIKE 'MOCK-%';"
sqlite3 "$DATABASE_LOCATION" "DELETE FROM categories WHERE id LIKE 'cat-mock-%';"
sqlite3 "$DATABASE_LOCATION" "DELETE FROM locations WHERE id LIKE 'loc-mock-%';"

# Generate category IDs and insert categories
CATEGORY_IDS=()
for i in "${!CATEGORIES[@]}"; do
    CATEGORY_ID="cat-mock-$(printf "%02d" $((i + 1)))"
    CATEGORY_NAME=$(escape_sql "${CATEGORIES[$i]}")
    CATEGORY_IDS+=("$CATEGORY_ID")

    sqlite3 "$DATABASE_LOCATION" "INSERT OR REPLACE INTO categories (id, name, created_at) VALUES ('$CATEGORY_ID', '$CATEGORY_NAME', datetime('now'));"
done

echo "Created ${#CATEGORY_IDS[@]} categories"

echo "Creating locations..."

# Generate location IDs and insert locations
LOCATION_IDS=()
for i in "${!LOCATIONS[@]}"; do
    LOCATION_ID="loc-mock-$(printf "%02d" $((i + 1)))"
    LOCATION_NAME=$(escape_sql "${LOCATIONS[$i]}")
    LOCATION_IDS+=("$LOCATION_ID")

    sqlite3 "$DATABASE_LOCATION" "INSERT OR REPLACE INTO locations (id, name, created_at) VALUES ('$LOCATION_ID', '$LOCATION_NAME', datetime('now'));"
done

echo "Created ${#LOCATION_IDS[@]} locations"

# Get project ID from database (assuming there's at least one project)
PROJECT_ID=$(sqlite3 "$DATABASE_LOCATION" "SELECT json_extract(json_extract(json_extract(value, '\$.project'), '\$.id'), '\$') FROM json_each(readfile(replace('$DATABASE_LOCATION', '/project.db', '/manifest.json')));" 2>/dev/null || echo "default-project-id")

echo "Creating $NUM_PRODUCTS products..."

# Create asset entry
sqlite3 "$DATABASE_LOCATION" "INSERT OR REPLACE INTO assets (hash, original_name, mimetype, size, width, height, ref_count, created_at, last_accessed) VALUES ('$ASSET_HASH', 'mock_image.jpg', 'image/jpeg', 1024000, 1920, 1080, $NUM_PRODUCTS, datetime('now'), datetime('now'));"

# Generate products
for ((i=1; i<=NUM_PRODUCTS; i++)); do
    PRODUCT_ID=$(generate_uuid)
    TAG_ID="MOCK-$(printf "%05d" $i)"
    URL="https://example.com/product/$i"

    # Random selections
    MANUFACTURER=$(get_random_element "${MANUFACTURERS[@]}")
    PRODUCT_TYPE=$(get_random_element "${PRODUCT_TYPES[@]}")
    PRICE=$(generate_price)

    # Random category selection (1-3 categories per product)
    NUM_CATEGORIES=$((RANDOM % 3 + 1))
    SELECTED_CATEGORIES=()
    for ((j=0; j<NUM_CATEGORIES; j++)); do
        RANDOM_CAT_ID=$(get_random_element "${CATEGORY_IDS[@]}")
        if [[ ! " ${SELECTED_CATEGORIES[@]} " =~ " ${RANDOM_CAT_ID} " ]]; then
            SELECTED_CATEGORIES+=("$RANDOM_CAT_ID")
        fi
    done
    CATEGORY_JSON="[\"$(IFS='","'; echo "${SELECTED_CATEGORIES[*]}")\"]"

    # Random location selection (1-2 locations per product)
    NUM_LOCATIONS=$((RANDOM % 2 + 1))
    SELECTED_LOCATIONS=()
    for ((j=0; j<NUM_LOCATIONS; j++)); do
        RANDOM_LOC_ID=$(get_random_element "${LOCATION_IDS[@]}")
        if [[ ! " ${SELECTED_LOCATIONS[@]} " =~ " ${RANDOM_LOC_ID} " ]]; then
            SELECTED_LOCATIONS+=("$RANDOM_LOC_ID")
        fi
    done
    LOCATION_JSON="[\"$(IFS='","'; echo "${SELECTED_LOCATIONS[*]}")\"]"

    # Product name and descriptions
    PRODUCT_NAME="Mock Product $i - $PRODUCT_TYPE"
    SPECIFICATION_DESC="This is a mock product specification for testing purposes. Product number $i with type $PRODUCT_TYPE."

    # Escape single quotes
    PRODUCT_NAME=$(escape_sql "$PRODUCT_NAME")
    SPECIFICATION_DESC=$(escape_sql "$SPECIFICATION_DESC")
    MANUFACTURER=$(escape_sql "$MANUFACTURER")
    PRODUCT_TYPE=$(escape_sql "$PRODUCT_TYPE")

    # Insert product
    sqlite3 "$DATABASE_LOCATION" "
    INSERT INTO products (
        id, project_id, url, tag_id, location, type, specification_description,
        category, product_name, manufacturer, price, primary_image_hash,
        primary_thumbnail_hash, additional_images_hashes, created_at, updated_at
    ) VALUES (
        '$PRODUCT_ID',
        '$PROJECT_ID',
        '$URL',
        '$TAG_ID',
        '$LOCATION_JSON',
        '$PRODUCT_TYPE',
        '$SPECIFICATION_DESC',
        '$CATEGORY_JSON',
        '$PRODUCT_NAME',
        '$MANUFACTURER',
        $PRICE,
        '$ASSET_HASH',
        '$ASSET_HASH',
        '[]',
        datetime('now'),
        datetime('now')
    );"

    if ((i % 10 == 0)); then
        echo "Created $i products..."
    fi
done

echo "Successfully created $NUM_PRODUCTS mock products!"
echo "Database location: $DATABASE_LOCATION"
echo ""
echo "Summary:"
echo "- Categories: ${#CATEGORY_IDS[@]}"
echo "- Locations: ${#LOCATION_IDS[@]}"
echo "- Products: $NUM_PRODUCTS"
echo "- Asset hash used: $ASSET_HASH"
echo ""
echo "You can now open this project in the Specbook application."