import React, { useState, useRef, useEffect } from 'react';
import './EditableSection.css';

interface EditableSectionProps {
  value: string | number | undefined;
  label: string;
  type?: 'text' | 'number' | 'select' | 'textarea';
  options?: string[]; // For select type
  placeholder?: string;
  onSave: (value: string | number) => Promise<void>;
  onCancel?: () => void;
  disabled?: boolean;
  required?: boolean;
  multiline?: boolean;
  className?: string;
  formatDisplay?: (value: string | number | undefined) => string;
}

export const EditableSection: React.FC<EditableSectionProps> = ({
  value,
  label,
  type = 'text',
  options = [],
  placeholder,
  onSave,
  onCancel,
  disabled = false,
  required = false,
  multiline = false,
  className = '',
  formatDisplay
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Format display value
  const displayValue = formatDisplay 
    ? formatDisplay(value) 
    : (value !== undefined && value !== null && value !== '') 
      ? String(value) 
      : 'Not specified';

  // Start editing mode
  const handleEdit = () => {
    if (disabled) return;
    
    setIsEditing(true);
    setEditValue(value !== undefined && value !== null ? String(value) : '');
    setError(null);
  };

  // Cancel editing
  const handleCancel = () => {
    setIsEditing(false);
    setEditValue('');
    setError(null);
    onCancel?.();
  };

  // Save changes
  const handleSave = async () => {
    if (required && !editValue.trim()) {
      setError('This field is required');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      let valueToSave: string | number = editValue.trim();
      
      if (type === 'number' && valueToSave) {
        const numValue = parseFloat(valueToSave);
        if (isNaN(numValue)) {
          setError('Please enter a valid number');
          setIsSaving(false);
          return;
        }
        valueToSave = numValue;
      }

      await onSave(valueToSave);
      setIsEditing(false);
      setEditValue('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle key events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !multiline) {
      e.preventDefault();
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  // Focus input when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if ((type === 'text' || type === 'textarea') && 'select' in inputRef.current) {
        (inputRef.current as HTMLInputElement | HTMLTextAreaElement).select();
      }
    }
  }, [isEditing, type]);

  // Render input based on type
  const renderInput = () => {
    const commonProps = {
      ref: inputRef,
      value: editValue,
      onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => 
        setEditValue(e.target.value),
      onKeyDown: handleKeyDown,
      disabled: isSaving,
      placeholder,
      className: 'editable-input'
    };

    switch (type) {
      case 'textarea':
        return (
          <textarea
            {...commonProps}
            ref={inputRef as React.RefObject<HTMLTextAreaElement>}
            rows={3}
          />
        );
      case 'select':
        return (
          <select
            {...commonProps}
            ref={inputRef as React.RefObject<HTMLSelectElement>}
          >
            <option value="">-- Select --</option>
            {options.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      case 'number':
        return (
          <input
            {...commonProps}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="number"
            step="any"
          />
        );
      case 'text':
      default:
        return (
          <input
            {...commonProps}
            ref={inputRef as React.RefObject<HTMLInputElement>}
            type="text"
          />
        );
    }
  };

  return (
    <div className={`editable-section ${className}`}>
      <div className="editable-label">
        <label>{label}</label>
        {required && <span className="required-indicator">*</span>}
      </div>
      
      {!isEditing ? (
        <div className="editable-display">
          <div 
            className={`display-value ${disabled ? 'disabled' : 'clickable'}`}
            onClick={handleEdit}
            title={disabled ? undefined : 'Click to edit'}
          >
            {displayValue}
          </div>
          {!disabled && (
            <button
              type="button"
              className="edit-button"
              onClick={handleEdit}
              title="Edit"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                <path d="M12.5 1l2.5 2.5L6 12.5H3v-3L12.5 1z" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
        </div>
      ) : (
        <div className="editable-edit">
          <div className="edit-input-wrapper">
            {renderInput()}
          </div>
          
          <div className="edit-actions">
            <button
              type="button"
              className="button button-primary button-small"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="button button-secondary button-small"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </button>
          </div>
          
          {error && (
            <div className="edit-error">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  );
};