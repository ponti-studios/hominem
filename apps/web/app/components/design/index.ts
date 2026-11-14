// The design system barrel. Routes and modules must import UI through
// here — never `@ponti-studios/ui` or `~/components/ui` directly.
// Enforced by `app/lib/design-boundary.test.ts`.
export { PageHeader } from './page-header';
export { AddButton } from './add-button';
export { FilterTabs, PanelState, SectionCard, Stat } from './surfaces';
export { CardHeader } from './card-header';
export { DataTable, type DataTableColumn } from './data-table';
export { Currency } from './currency';
export { ChartCard } from './chart-card';
export { Field, SelectField } from './form-field';
export { List, RowLink } from './lists';
export { SectionHeader } from './section-header';
export { KeyValue, KeyValueList } from './key-value';
export { Meter } from './meter';
export { ProgressBar } from './progress-bar';
export { Transaction } from './transaction';
export { BlockSkeleton, ListSkeleton } from './skeleton';
export { SearchInput } from './search-input';
export { Container } from './container';
export { InitialsAvatar } from './avatar';
export { BackLink, DetailField, DetailHero, DetailSection } from './detail';
export { DeleteButton } from './delete-button';
export { Chip } from './chip';
export {
  CurrencyField,
  FormActions,
  FormGrid,
  IconField,
  PrefixInput,
  TextAreaInput,
  TextInput,
  type FieldBinding,
} from './forms';
