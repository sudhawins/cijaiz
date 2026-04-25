import React, { useState } from 'react';
import './SearchableCategoryDropdown.css';

const SearchableCategoryDropdown = ({ categories, value, onChange, placeholder = 'Select a category' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = React.useRef(null);

  const filteredCategories = searchTerm.trim() === '' 
    ? categories 
    : categories.filter(category =>
        category.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

  const selectedCategoryObj = categories.find(c => c.id === parseInt(value));

  const handleSelect = (categoryId) => {
    onChange({ target: { value: categoryId } });
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
        value={isOpen ? searchTerm : (selectedCategoryObj ? selectedCategoryObj.name : '')}
        onChange={handleInputChange}
        onFocus={handleInputFocus}
        placeholder={placeholder}
        className="dropdown-input"
        autoComplete="off"
      />
      {isOpen && (
        <div className="dropdown-menu">
          {filteredCategories.length > 0 ? (
            filteredCategories.map(category => (
              <div
                key={category.id}
                className={`dropdown-item ${value === String(category.id) ? 'selected' : ''}`}
                onClick={() => handleSelect(category.id)}
              >
                <div className="category-name">{category.name}</div>
              </div>
            ))
          ) : (
            <div className="dropdown-no-results">No categories found</div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchableCategoryDropdown;
