import React, { useState } from 'react';
import { Category } from '../../types';
import './CategoryMultiSelect.css';

interface CategoryMultiSelectProps {
  selectedCategories: string[];
  onSelectionChange: (categories: string[]) => void;
  availableCategories: Category[];
  onAddCategory: (category: string) => Promise<void>;
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

  const handleCategoryToggle = (category: string) => {
    if (selectedCategories.includes(category)) {
      // Remove category
      onSelectionChange(selectedCategories.filter(cat => cat !== category));
    } else {
      // Add category
      onSelectionChange([...selectedCategories, category]);
    }
  };

  const handleRemoveCategory = (categoryToRemove: string) => {
    onSelectionChange(selectedCategories.filter(cat => cat !== categoryToRemove));
  };

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      return;
    }

    setIsAdding(true);
    try {
      await onAddCategory(newCategory.trim());
      // Add the new category to selection
      onSelectionChange([...selectedCategories, newCategory.trim()]);
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
    category => !selectedCategories.includes(category.name)
  );

  return (
    <div className={`category-multi-select ${className}`}>
      {/* Selected categories display */}
      {selectedCategories.length > 0 && (
        <div className="selected-categories">
          <label className="selected-categories-label">Selected categories:</label>
          <div className="category-tags">
            {selectedCategories.map(category => (
              <div key={category} className="category-tag">
                <span>{category}</span>
                <button
                  type="button"
                  className="category-tag-remove"
                  onClick={() => handleRemoveCategory(category)}
                  disabled={disabled}
                  aria-label={`Remove ${category}`}
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
              <option key={category.id} value={category.name}>
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