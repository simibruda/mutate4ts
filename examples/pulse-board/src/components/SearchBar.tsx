interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  const empty = value.trim() === "";
  return (
    <div className="search-bar">
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Search tasks, notes, tags"
        aria-label="Search tasks"
      />
      {empty ? null : (
        <button type="button" onClick={() => onChange("")}>
          Clear
        </button>
      )}
    </div>
  );
}
