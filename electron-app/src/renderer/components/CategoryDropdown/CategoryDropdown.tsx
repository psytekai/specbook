import React, { useState } from 'react';
import './CategoryDropdown.css';

interface CategoryDropdownProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  onAddCategory: (category: string) => Promise<void>;
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const CategoryDropdown: React.FC<CategoryDropdownProps> = ({
  categories,
  selectedCategory,
  onCategoryChange,
  onAddCategory,
  disabled = false,
  required = false,
  className = ''
}) => {
  const [showAddCategory, setShowAddCategory] = useState(false);
  const [newCategory, setNewCategory] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleAddCategory = async () => {
    if (!newCategory.trim()) {
      return;
    }

    setIsAdding(true);
    try {
      await onAddCategory(newCategory.trim());
      onCategoryChange(newCategory.trim());
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

  return (
    <div className={`category-dropdown ${className}`}>
      {!showAddCategory ? (
        <div className="location-dropdown-wrapper">
          <select
            id="category"
            name="category"
            className="input"
            value={selectedCategory}
            onChange={(e) => onCategoryChange(e.target.value)}
            required={required}
            disabled={disabled}
          >
            <option value="">-- Select a category --</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {category}
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
        <div className="add-location-wrapper">
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
          <div className="add-location-actions">
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
    </div>
  );
};