import React, { useState } from 'react';
import { Location } from '../../types';
import './LocationMultiSelect.css';

interface LocationMultiSelectProps {
  selectedLocations: string[]; // Array of location IDs
  onSelectionChange: (locationIds: string[]) => void;
  availableLocations: Location[];
  onAddLocation: (locationName: string) => Promise<Location>; // Returns the created location with ID
  disabled?: boolean;
  required?: boolean;
  className?: string;
}

export const LocationMultiSelect: React.FC<LocationMultiSelectProps> = ({
  selectedLocations,
  onSelectionChange,
  availableLocations,
  onAddLocation,
  disabled = false,
  required = false,
  className = ''
}) => {
  const [showAddLocation, setShowAddLocation] = useState(false);
  const [newLocation, setNewLocation] = useState('');
  const [isAdding, setIsAdding] = useState(false);

  const handleLocationToggle = (locationId: string) => {
    if (selectedLocations.includes(locationId)) {
      // Remove location
      onSelectionChange(selectedLocations.filter(id => id !== locationId));
    } else {
      // Add location
      onSelectionChange([...selectedLocations, locationId]);
    }
  };

  const handleRemoveLocation = (locationIdToRemove: string) => {
    onSelectionChange(selectedLocations.filter(id => id !== locationIdToRemove));
  };

  const handleAddLocation = async () => {
    if (!newLocation.trim()) {
      return;
    }

    setIsAdding(true);
    try {
      const createdLocation = await onAddLocation(newLocation.trim());
      // Add the new location ID to selection
      onSelectionChange([...selectedLocations, createdLocation.id]);
      setNewLocation('');
      setShowAddLocation(false);
    } catch (error) {
      console.error('Failed to add location:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleCancel = () => {
    setShowAddLocation(false);
    setNewLocation('');
  };

  const availableForSelection = availableLocations.filter(
    location => !selectedLocations.includes(location.id)
  );

  // Helper function to get location name by ID
  const getLocationName = (locationId: string): string => {
    const location = availableLocations.find(loc => loc.id === locationId);
    return location ? location.name : locationId; // Fallback to ID if name not found
  };

  return (
    <div className={`location-multi-select ${className}`}>
      {/* Selected locations display */}
      {selectedLocations.length > 0 && (
        <div className="selected-locations">
          <label className="selected-locations-label">Selected locations:</label>
          <div className="location-tags">
            {selectedLocations.map(locationId => (
              <div key={locationId} className="location-tag">
                <span>{getLocationName(locationId)}</span>
                <button
                  type="button"
                  className="location-tag-remove"
                  onClick={() => handleRemoveLocation(locationId)}
                  disabled={disabled}
                  aria-label={`Remove ${getLocationName(locationId)}`}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Location selection */}
      {!showAddLocation ? (
        <div className="location-dropdown-wrapper">
          <select
            className="input"
            value=""
            onChange={(e) => {
              if (e.target.value) {
                handleLocationToggle(e.target.value);
                e.target.value = ''; // Reset select
              }
            }}
            disabled={disabled}
          >
            <option value="">
              {availableForSelection.length > 0 
                ? "-- Add a location --" 
                : "-- All locations selected --"
              }
            </option>
            {availableForSelection.map(location => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="button button-secondary button-small"
            onClick={() => setShowAddLocation(true)}
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
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            placeholder="Enter new location"
            autoFocus
            disabled={isAdding}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddLocation();
              } else if (e.key === 'Escape') {
                handleCancel();
              }
            }}
          />
          <div className="add-location-actions">
            <button
              type="button"
              className="button button-primary button-small"
              onClick={handleAddLocation}
              disabled={isAdding || !newLocation.trim()}
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
      {required && selectedLocations.length === 0 && (
        <div className="location-validation-error">
          At least one location is required
        </div>
      )}
    </div>
  );
};