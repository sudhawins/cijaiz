import SearchableDropdown from './SearchableDropdown';

export type SearchField = 'all' | 'name' | 'phone' | 'city' | 'address' | 'room';
export type SortOption = 'name-asc' | 'name-desc' | 'phone-asc' | 'city-asc' | 'recently-added';

interface TenantSearchFiltersProps {
  searchQuery: string;
  searchField: SearchField;
  sortBy: SortOption;
  onSearchQueryChange: (query: string) => void;
  onSearchFieldChange: (field: SearchField) => void;
  onSortByChange: (option: SortOption) => void;
  onClearSearch: () => void;
}

const searchFieldOptions: { value: SearchField; label: string }[] = [
  { value: 'all', label: 'All Fields' },
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone Number' },
  { value: 'city', label: 'City' },
  { value: 'address', label: 'Address' },
  { value: 'room', label: 'Room Number' },
];

export default function TenantSearchFilters({
  searchQuery,
  searchField,
  sortBy,
  onSearchQueryChange,
  onSearchFieldChange,
  onSortByChange,
  onClearSearch,
}: TenantSearchFiltersProps) {
  return (
    <div className="search-section">
      <div className="search-container">
        <input
          type="text"
          placeholder={searchField === 'phone' ? 'Search phone numbers...' : 'Search tenants...'}
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          className="search-input"
        />
        <span className="search-icon">🔍</span>
      </div>
      <div className="filter-container">
        <label htmlFor="search-field">Search by:</label>
        <SearchableDropdown
          value={searchField}
          onChange={(option) => onSearchFieldChange(option.id as SearchField)}
          options={searchFieldOptions.map(opt => ({ id: opt.value, label: opt.label }))}
          placeholder="Select field..."
        />
      </div>
      <div className="sort-container">
        <label htmlFor="sort-by">Sort by:</label>
        <SearchableDropdown
          value={sortBy}
          onChange={(option) => onSortByChange(option.id as SortOption)}
          options={[
            { id: 'name-asc', label: 'Name (A→Z)' },
            { id: 'name-desc', label: 'Name (Z→A)' },
            { id: 'phone-asc', label: 'Phone Number' },
            { id: 'city-asc', label: 'City' },
            { id: 'recently-added', label: 'Recently Added' }
          ]}
          placeholder="Select sort..."
        />
      </div>
      {searchQuery && (
        <button
          className="btn-secondary btn-clear"
          onClick={onClearSearch}
        >
          Clear Search
        </button>
      )}
    </div>
  );
}
