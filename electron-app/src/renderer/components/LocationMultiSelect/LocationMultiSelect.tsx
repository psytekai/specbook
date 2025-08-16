import React, { useState } from 'react';
import './LocationMultiSelect.css';

interface LocationMultiSelectProps {
  selectedLocations: string[];
  onSelectionChange: (locations: string[]) => void;
  availableLocations: string[];
  onAddLocation: (location: string) => Promise<void>;
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

  const handleLocationToggle = (location: string) => {
    if (selectedLocations.includes(location)) {
      // Remove location
      onSelectionChange(selectedLocations.filter(loc => loc !== location));
    } else {
      // Add location
      onSelectionChange([...selectedLocations, location]);
    }
  };

  const handleRemoveLocation = (locationToRemove: string) => {
    onSelectionChange(selectedLocations.filter(loc => loc !== locationToRemove));
  };

  const handleAddLocation = async () => {
    if (!newLocation.trim()) {
      return;
    }

    setIsAdding(true);
    try {
      await onAddLocation(newLocation.trim());
      // Add the new location to selection
      onSelectionChange([...selectedLocations, newLocation.trim()]);
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
    location => !selectedLocations.includes(location)
  );

  return (
    <div className={`location-multi-select ${className}`}>
      {/* Selected locations display */}
      {selectedLocations.length > 0 && (
        <div className="selected-locations">
          <label className="selected-locations-label">Selected locations:</label>
          <div className="location-tags">
            {selectedLocations.map(location => (
              <div key={location} className="location-tag">
                <span>{location}</span>
                <button
                  type="button"
                  className="location-tag-remove"
                  onClick={() => handleRemoveLocation(location)}
                  disabled={disabled}
                  aria-label={`Remove ${location}`}
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
              <option key={location} value={location}>
                {location}
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