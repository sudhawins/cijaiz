import React, { useState } from 'react';
import './SearchableSubcategoryDropdown.css';

const SearchableSubcategoryDropdown = ({
  subcategories,
  value,
  onChange,
  placeholder = 'Select a subcategory',
  categoryId = null
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef(null);

  // Filter subcategories by category if categoryId is provided
  const categoryFilteredSubcategories = categoryId
    ? subcategories.filter(sub => sub.category_id === parseInt(categoryId))
    : subcategories;

  const filteredSubcategories = searchTerm.trim() === ''
    ? categoryFilteredSubcategories
    : categoryFilteredSubcategories.filter(subcategory =>
        subcategory.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const selectedSubcategoryObj = subcategories.find(s => s.id === parseInt(value));

  const handleSelect = (subcategoryId) => {
    onChange({ target: { value: subcategoryId } });
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleInputChange = (e) => {
    setSearchTerm(e.target.value);
    setIsOpen(true);
  };

  const handleInputFocus = () => {
    setIsOpen(true);
  };

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="searchable-dropdown" ref={dropdownRef}>
      <input
        type="text"
        value={isOpen ? searchTerm : (selectedSubcategoryObj ? selectedSubcategoryObj.name : '')}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className="dropdown-input"
        autoComplete="off"
      />
      {isOpen && (
        <div className="dropdown-menu">
          {filteredSubcategories.length > 0 ? (
            filteredSubcategories.map(subcategory => (
              <div
                key={subcategory.id}
                className={`dropdown-item ${value === String(subcategory.id) ? 'selected' : ''}`}
                onClick={() => handleSelect(subcategory.id)}
              >
                <div className="subcategory-name">{subcategory.name}</div>
                {subcategory.description && (
                  <div className="subcategory-description">{subcategory.description}</div>
                )}
              </div>
            ))
          ) : (
            <div className="dropdown-no-results">
              {categoryId ? 'No subcategories found for this category' : 'No subcategories found'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableSubcategoryDropdown;