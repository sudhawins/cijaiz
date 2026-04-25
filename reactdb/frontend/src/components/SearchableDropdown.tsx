import { useState, useRef, useEffect } from 'react';
import '../styles/SearchableDropdown.css';

interface Option {
  id: string | number;
  label: string;
  value?: string | number;
  optionClassName?: string;
  optionBadgeText?: string;
  optionBadgeVariant?: 'default' | 'success' | 'warning';
  [key: string]: any;
}

interface SearchableDropdownProps {
  options: Option[];
  value: string | number | null;
  onChange: (option: Option) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  label?: string;
  isLoading?: boolean;
  error?: string | null;
  disabled?: boolean;
  onSearch?: (searchTerm: string) => void;
}

export default function SearchableDropdown({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  searchPlaceholder = 'Search...',
  label,
  isLoading = false,
  error = null,
  disabled = false,
  onSearch,
}: SearchableDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<Option[]>(options);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Get the display label for the selected value
  const selectedOption = options.find(opt => opt.id === value);
  const displayLabel = selectedOption ? selectedOption.label : placeholder;

  // Filter options based on search term
  useEffect(() => {
    if (!searchTerm) {
      setFilteredOptions(options);
      onSearch?.('');
    } else {
      const term = searchTerm.toLowerCase();
      const filtered = options.filter(opt =>
        opt.label.toLowerCase().includes(term) ||
        (opt.value && opt.value.toString().toLowerCase().includes(term))
      );
      setFilteredOptions(filtered);
      onSearch?.(term);
    }
  }, [searchTerm, options, onSearch]);

  // Handle click/touch outside
  useEffect(() => {
    function handleClickOutside(event: Event) {
      // Check if click is within the dropdown wrapper
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }

    // Add small delay to allow clicks within dropdown to register first
    if (isOpen) {
      const timeoutId = setTimeout(() => {
        document.addEventListener('pointerdown', handleClickOutside, true);
        document.addEventListener('touchstart', handleClickOutside, true);
      }, 50);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('pointerdown', handleClickOutside, true);
        document.removeEventListener('touchstart', handleClickOutside, true);
      };
    }
  }, [isOpen]);

  // Focus input when dropdown opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  // Prevent body scroll on mobile when dropdown is open
  useEffect(() => {
    if (isOpen && window.innerWidth <= 480) {
      // Store the current scroll position
      const scrollY = window.scrollY;
      const originalOverflow = document.body.style.overflow;
      const originalPosition = document.body.style.position;
      
      document.body.style.overflow = 'hidden';
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollY}px`;
      document.body.style.width = '100%';
      
      return () => {
        // Restore scroll position and styles
        document.body.style.overflow = originalOverflow;
        document.body.style.position = originalPosition;
        document.body.style.top = '';
        document.body.style.width = '';
        window.scrollTo(0, scrollY);
      };
    }
  }, [isOpen]);

  const handleSelect = (option: Option) => {
    onChange(option);
    setSearchTerm('');
    setIsOpen(false);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleInputClick = () => {
    setIsOpen(true);
    setSearchTerm('');
  };

  const handleOptionSelect = (option: Option, e?: React.PointerEvent<HTMLDivElement> | React.MouseEvent<HTMLDivElement>) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    handleSelect(option);
  };

  const handleOptionTouchStart = (option: Option, e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    handleSelect(option);
  };

  return (
    <div ref={wrapperRef} className="searchable-dropdown-wrapper">
      {label && <label className="dropdown-label">{label}</label>}
      
      <div className={`searchable-dropdown ${isOpen ? 'open' : ''} ${error ? 'error' : ''} ${disabled ? 'disabled' : ''}`}>
        <div
          className="dropdown-input-wrapper"
          onClick={() => !disabled && handleInputClick()}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              !disabled && handleInputClick();
            }
          }}
        >
          <input
            ref={inputRef}
            type="text"
            className="dropdown-input"
            placeholder={searchPlaceholder}
            value={isOpen ? searchTerm : displayLabel}
            onChange={handleInputChange}
            onClick={handleInputClick}
            disabled={disabled}
          />
          <span className={`dropdown-arrow ${isOpen ? 'open' : ''}`}>
            {isLoading ? '⟳' : '▼'}
          </span>
        </div>

        {error && <div className="dropdown-error">{error}</div>}

        {isOpen && (
          <div className="dropdown-options">
            {isLoading ? (
              <div className="dropdown-loading">Loading...</div>
            ) : filteredOptions.length > 0 ? (
              filteredOptions.map(option => (
                <div
                  key={option.id}
                  className={`dropdown-option ${value === option.id ? 'selected' : ''} ${option.optionClassName || ''}`}
                  onClick={(e) => handleOptionSelect(option, e)}
                  onTouchStart={(e) => handleOptionTouchStart(option, e)}
                  role="option"
                  aria-selected={value === option.id}
                >
                  <span className="dropdown-option-label">{option.label}</span>
                  {option.optionBadgeText && (
                    <span className={`dropdown-option-badge ${option.optionBadgeVariant || 'default'}`}>
                      {option.optionBadgeText}
                    </span>
                  )}
                </div>
              ))
            ) : (
              <div className="dropdown-empty">
                {searchTerm ? 'No results found' : 'No options available'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
