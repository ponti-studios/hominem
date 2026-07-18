import { EntitySelect } from '@ponti-studios/ui/forms';

interface TagOption {
  id: string;
  name: string;
}

interface TagSelectProps {
  selectedTag: string;
  onTagChange: (value: string) => void;
  tags: TagOption[];
  isLoading?: boolean;
  placeholder?: string;
  label?: string;
  className?: string;
}

export function TagSelect({
  selectedTag,
  onTagChange,
  tags,
  isLoading = false,
  placeholder = 'All tags',
  label = 'Tag',
  className,
}: TagSelectProps) {
  return (
    <EntitySelect
      value={selectedTag}
      onValueChange={onTagChange}
      options={tags || []}
      isLoading={isLoading}
      placeholder={placeholder}
      label={label}
      className={className}
      showLabel
      allOptionLabel="All tags"
      emptyLabel="No tags available"
    />
  );
}
