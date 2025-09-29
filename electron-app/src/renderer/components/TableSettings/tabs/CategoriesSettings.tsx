import React, { useState } from 'react';
import { Category } from '../../../types';

interface CategoriesSettingsProps {
  categories: Category[];
  onAddCategory: (name: string) => Promise<Category>;
  onUpdateCategory: (id: string, name: string) => Promise<Category>;
  onDeleteCategory: (id: string) => Promise<boolean>;
}

export const CategoriesSettings: React.FC<CategoriesSettingsProps> = ({
  categories,
  onAddCategory,
  onUpdateCategory,
  onDeleteCategory
}) => {
  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) return;

    setIsAdding(true);
    try {
      await onAddCategory(newCategoryName.trim());
      setNewCategoryName('');
    } catch (error) {
      console.error('Failed to add category:', error);
      alert('Failed to add category. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (category: Category) => {
    setEditingId(category.id);
    setEditingName(category.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    setIsUpdating(true);
    try {
      await onUpdateCategory(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update category:', error);
      alert('Failed to update category. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteCategory = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"? This will remove it from all products that reference it.`
    );
    
    if (!confirmed) return;

    setIsDeleting(id);
    try {
      await onDeleteCategory(id);
    } catch (error) {
      console.error('Failed to delete category:', error);
      alert('Failed to delete category. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="categories-settings">
      <div className="settings-section">
        <h3>Manage Categories</h3>
        <p className="settings-description">
          Add, edit, or delete categories. Deleting a category will remove it from all products.
        </p>

        {/* Add new category */}
        <div className="add-item-section">
          <div className="add-item-form">
            <input
              type="text"
              className="input"
              placeholder="Enter new category name"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddCategory();
                }
              }}
              disabled={isAdding}
            />
            <button
              className="button button-primary"
              onClick={handleAddCategory}
              disabled={isAdding || !newCategoryName.trim()}
            >
              {isAdding ? 'Adding...' : 'Add Category'}
            </button>
          </div>
        </div>

        {/* Categories list */}
        <div className="items-list">
          {categories.length === 0 ? (
            <div className="empty-state">
              <p>No categories found. Add your first category above.</p>
            </div>
          ) : (
            <div className="items-table">
              <div className="table-header">
                <div className="header-cell name-header">Name</div>
                <div className="header-cell created-header">Created</div>
                <div className="header-cell actions-header">Actions</div>
              </div>
              <div className="table-body">
                {categories.map(category => (
                  <div key={category.id} className="table-row">
                    <div className="table-cell name-cell">
                      {editingId === category.id ? (
                        <input
                          type="text"
                          className="input edit-input"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleSaveEdit();
                            } else if (e.key === 'Escape') {
                              handleCancelEdit();
                            }
                          }}
                          autoFocus
                          disabled={isUpdating}
                        />
                      ) : (
                        <span className="item-name">{category.name}</span>
                      )}
                    </div>
                    <div className="table-cell created-cell">
                      <span className="created-date">
                        {new Date(category.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="table-cell actions-cell">
                      {editingId === category.id ? (
                        <div className="edit-actions">
                          <button
                            className="action-button save"
                            onClick={handleSaveEdit}
                            disabled={isUpdating || !editingName.trim()}
                            title="Save changes"
                          >
                            {isUpdating ? '...' : '✓'}
                          </button>
                          <button
                            className="action-button cancel"
                            onClick={handleCancelEdit}
                            disabled={isUpdating}
                            title="Cancel editing"
                          >
                            ✕
                          </button>
                        </div>
                      ) : (
                        <div className="item-actions">
                          <button
                            className="action-button edit"
                            onClick={() => handleStartEdit(category)}
                            title="Edit category"
                          >
                            ✏️
                          </button>
                          <button
                            className="action-button delete"
                            onClick={() => handleDeleteCategory(category.id, category.name)}
                            disabled={isDeleting === category.id}
                            title="Delete category"
                          >
                            {isDeleting === category.id ? '...' : '🗑️'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
