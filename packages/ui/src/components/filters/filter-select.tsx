import { useId } from "react";

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../select";

export interface FilterSelectOption<T extends string> {
  value: T;
  label: string;
}

export interface FilterSelectProps<T extends string> {
  label: string;
  value: T | "";
  options: Array<FilterSelectOption<T>>;
  onChange: (value: T | "") => void;
  placeholder?: string;
  id?: string;
}

const ALL_VALUE = "__all__" as const;

export function FilterSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = "All",
  id,
}: FilterSelectProps<T>) {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const selectValue = value === "" ? ALL_VALUE : value;

  return (
    <div className="flex-1">
      <label
        htmlFor={selectId}
        className="text-muted-foreground mb-1.5 block text-xs font-medium tracking-wide uppercase"
      >
        {label}
      </label>
      <Select
        value={selectValue}
        onValueChange={(nextValue) =>
          onChange((nextValue === ALL_VALUE ? "" : nextValue) as T | "")
        }
      >
        <SelectTrigger id={selectId} className="w-full">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_VALUE}>{placeholder}</SelectItem>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
