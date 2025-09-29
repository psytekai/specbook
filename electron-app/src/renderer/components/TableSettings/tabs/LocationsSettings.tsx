import React, { useState } from 'react';
import { Location } from '../../../types';

interface LocationsSettingsProps {
  locations: Location[];
  onAddLocation: (name: string) => Promise<Location>;
  onUpdateLocation: (id: string, name: string) => Promise<Location>;
  onDeleteLocation: (id: string) => Promise<boolean>;
}

export const LocationsSettings: React.FC<LocationsSettingsProps> = ({
  locations,
  onAddLocation,
  onUpdateLocation,
  onDeleteLocation
}) => {
  const [newLocationName, setNewLocationName] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  const handleAddLocation = async () => {
    if (!newLocationName.trim()) return;

    setIsAdding(true);
    try {
      await onAddLocation(newLocationName.trim());
      setNewLocationName('');
    } catch (error) {
      console.error('Failed to add location:', error);
      alert('Failed to add location. Please try again.');
    } finally {
      setIsAdding(false);
    }
  };

  const handleStartEdit = (location: Location) => {
    setEditingId(location.id);
    setEditingName(location.name);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const handleSaveEdit = async () => {
    if (!editingId || !editingName.trim()) return;

    setIsUpdating(true);
    try {
      await onUpdateLocation(editingId, editingName.trim());
      setEditingId(null);
      setEditingName('');
    } catch (error) {
      console.error('Failed to update location:', error);
      alert('Failed to update location. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteLocation = async (id: string, name: string) => {
    const confirmed = window.confirm(
      `Are you sure you want to delete "${name}"? This will remove it from all products that reference it.`
    );
    
    if (!confirmed) return;

    setIsDeleting(id);
    try {
      await onDeleteLocation(id);
    } catch (error) {
      console.error('Failed to delete location:', error);
      alert('Failed to delete location. Please try again.');
    } finally {
      setIsDeleting(null);
    }
  };

  return (
    <div className="locations-settings">
      <div className="settings-section">
        <h3>Manage Locations</h3>
        <p className="settings-description">
          Add, edit, or delete locations. Deleting a location will remove it from all products.
        </p>

        {/* Add new location */}
        <div className="add-item-section">
          <div className="add-item-form">
            <input
              type="text"
              className="input"
              placeholder="Enter new location name"
              value={newLocationName}
              onChange={(e) => setNewLocationName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddLocation();
                }
              }}
              disabled={isAdding}
            />
            <button
              className="button button-primary"
              onClick={handleAddLocation}
              disabled={isAdding || !newLocationName.trim()}
            >
              {isAdding ? 'Adding...' : 'Add Location'}
            </button>
          </div>
        </div>

        {/* Locations list */}
        <div className="items-list">
          {locations.length === 0 ? (
            <div className="empty-state">
              <p>No locations found. Add your first location above.</p>
            </div>
          ) : (
            <div className="items-table">
              <div className="table-header">
                <div className="header-cell name-header">Name</div>
                <div className="header-cell created-header">Created</div>
                <div className="header-cell actions-header">Actions</div>
              </div>
              <div className="table-body">
                {locations.map(location => (
                  <div key={location.id} className="table-row">
                    <div className="table-cell name-cell">
                      {editingId === location.id ? (
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
                        <span className="item-name">{location.name}</span>
                      )}
                    </div>
                    <div className="table-cell created-cell">
                      <span className="created-date">
                        {new Date(location.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="table-cell actions-cell">
                      {editingId === location.id ? (
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
                            onClick={() => handleStartEdit(location)}
                            title="Edit location"
                          >
                            ✏️
                          </button>
                          <button
                            className="action-button delete"
                            onClick={() => handleDeleteLocation(location.id, location.name)}
                            disabled={isDeleting === location.id}
                            title="Delete location"
                          >
                            {isDeleting === location.id ? '...' : '🗑️'}
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
