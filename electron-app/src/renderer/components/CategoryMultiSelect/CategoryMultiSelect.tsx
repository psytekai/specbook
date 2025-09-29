import React, { useState } from 'react';
import { Category } from '../../types';
import './CategoryMultiSelect.css';

interface CategoryMultiSelectProps {
  selectedCategories: string[]; // Array of category IDs
  onSelectionChange: (categoryIds: string[]) => void;
  availableCategories: Category[];
  onAddCategory: (categoryName: string) => Promise<Category>; // Returns the created category with ID
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const CategoryMultiSelect: React.FC<CategoryMultiSelectProps> = ({
  selectedCategories,
  onSelectionChange,
  availableCategories,
  onAddCategory,
  disabled = false,
  required = false,
  className = ''
}) => {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleCategoryToggle = (categoryId: string) => {
    if (selectedCategories.includes(categoryId)) {
      // Remove category
      onSelectionChange(selectedCategories.filter(id => id !== categoryId));
    } else {
      // Add category
      onSelectionChange([...selectedCategories, categoryId]);
    }
  };

  const handleRemoveCategory = (categoryIdToRemove: string) => {
    onSelectionChange(selectedCategories.filter(id => id !== categoryIdToRemove));
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      return;
    }

    setIsAdding(true);
    try {
      const createdCategory = await onAddCategory(newCategory.trim());
      // Add the new category ID to selection
      onSelectionChange([...selectedCategories, createdCategory.id]);
      setNewCategory('');
      setShowAddCategory(false);
    } catch (error) {
      console.error('Failed to add category:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setShowAddCategory(false);
    setNewCategory('');
  };

  const availableForSelection = availableCategories.filter(
    category => !selectedCategories.includes(category.id)
  );

  // Helper function to get category name by ID
  const getCategoryName = (categoryId: string): string => {
    const category = availableCategories.find(cat => cat.id === categoryId);
    return category ? category.name : categoryId; // Fallback to ID if name not found
  };

  return (
    <div className={`category-multi-select ${className}`}>
      {/* Selected categories display */}
      {selectedCategories.length > 0 && (
        <div className="selected-categories">
          <label className="selected-categories-label">Selected categories:</label>
          <div className="category-tags">
            {selectedCategories.map(categoryId => (
              <div key={categoryId} className="category-tag">
                <span>{getCategoryName(categoryId)}</span>
                <button
                  type="button"
                  className="category-tag-remove"
                  onClick={() => handleRemoveCategory(categoryId)}
                  disabled={disabled}
                  aria-label={`Remove ${getCategoryName(categoryId)}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Category selection */}
      {!showAddCategory ? (
        <div className="category-dropdown-wrapper">
          <select
            className="input"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                handleCategoryToggle(e.target.value);
                e.target.value = ''; // Reset select
              }
            }}
            disabled={disabled}
          >
            <option value="">
              {availableForSelection.length > 0 
                ? "-- Add a category --" 
                : "-- All categories selected --"
              }
            </option>
            {availableForSelection.map(category => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => setShowAddCategory(true)}
            disabled={disabled}
          >
            Add New
          </button>
        </div>
      ) : (
        <div className="add-category-wrapper">
          <input
            type="text"
            className="input"
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="Enter new category"
            autoFocus
            disabled={isAdding}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddCategory();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
          />
          <div className="add-category-actions">
            <button
              type="button"
              className="button button-primary button-small"
              onClick={handleAddCategory}
              disabled={isAdding || !newCategory.trim()}
            >
              {isAdding ? 'Adding...' : 'Add'}
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={handleCancel}
              disabled={isAdding}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Validation for required field */}
      {required && selectedCategories.length === 0 && (
        <div className="category-validation-error">
          At least one category is required
        </div>
      )}
    </div>
  );
};