export { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "./components/accordion";
export { Alert, AlertDescription, AlertTitle } from "./components/alert";
export {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "./components/alert-dialog";
export { AuthScaffold } from "./components/auth/auth-scaffold";
export { EmailEntryForm } from "./components/auth/email-entry-form";
export { OtpCodeInput } from "./components/auth/otp-code-input";
export { OtpVerificationForm } from "./components/auth/otp-verification-form";
export { PasskeyButton } from "./components/auth/passkey-button";
export { PasskeyManagement } from "./components/auth/passkey-management";
export type { AuthScaffoldProps } from "./components/auth/auth-scaffold";
export type { EmailEntryFormProps } from "./components/auth/email-entry-form";
export type { OtpCodeInputProps } from "./components/auth/otp-code-input";
export type { OtpVerificationFormProps } from "./components/auth/otp-verification-form";
export type { PasskeyButtonProps } from "./components/auth/passkey-button";
export type { PasskeyManagementProps, PasskeyRecord } from "./components/auth/passkey-management";
export { Avatar, AvatarFallback, AvatarGroup, AvatarGroupCount, AvatarImage } from "./components/avatar";
export { Badge, badgeVariants } from "./components/badge";
export { Button, buttonVariants } from "./components/button";
export { Calendar } from "./components/calendar";
export type { CalendarProps } from "./components/calendar";
export {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "./components/card";
export {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandListLoading,
  CommandSeparator,
  CommandShortcut,
} from "./components/command";
export { AppNavigation } from "./components/compound/app-navigation";
export { CountUpTo } from "./components/compound/count-up-to";
export { MetricCard } from "./components/compound/metric-card";
export { OnscreenKeyboard } from "./components/compound/onscreen-keyboard";
export { ParticleBackground } from "./components/compound/particle-background";
export { Spinner } from "./components/compound/spinner";
export type {
  AppNavigationCta,
  AppNavigationLink,
  AppNavigationProps,
  AppNavigationRenderLinkArgs,
} from "./components/compound/app-navigation";
export type { CountUpToProps } from "./components/compound/count-up-to";
export type { MetricCardProps } from "./components/compound/metric-card";
export type { LetterState, OnscreenKeyboardProps } from "./components/compound/onscreen-keyboard";
export type {
  ParticleBackgroundPalette,
  ParticleBackgroundProps,
} from "./components/compound/particle-background";
export type { SpinnerProps } from "./components/compound/spinner";
export { DatePicker } from "./components/date-picker";
export type { DatePickerProps } from "./components/date-picker";
export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
} from "./components/dialog";
export {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerPortal,
  DrawerTitle,
  DrawerTrigger,
} from "./components/drawer";
export {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "./components/dropdown-menu";
export { InlineEnhanceTray } from "./components/enhance/inline-enhance-tray";
export { useInlineEnhance } from "./components/enhance/use-inline-enhance";
export { Field } from "./components/field";
export type { FieldProps } from "./components/field";
export { ActiveFiltersBar } from "./components/filters/active-filters-bar";
export { FilterChip } from "./components/filters/filter-chip";
export { FilterControls } from "./components/filters/filter-controls";
export { FilterSelect } from "./components/filters/filter-select";
export type { ActiveFilter, ActiveFiltersBarProps } from "./components/filters/active-filters-bar";
export type { FilterChipProps } from "./components/filters/filter-chip";
export type { FilterControlsProps } from "./components/filters/filter-controls";
export type { FilterSelectOption, FilterSelectProps } from "./components/filters/filter-select";
export { InboxStreamRow } from "./components/inbox/inbox-stream-row";
export type {
  InboxStreamRowItem,
  InboxStreamRowLinkProps,
  InboxStreamRowProps,
} from "./components/inbox/inbox-stream-row";
export { Input } from "./components/input";
export { LoadingSpinner } from "./components/loading-spinner";
export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from "./components/popover";
export { PercentageProgressBar, Progress, VolumeProgressBar } from "./components/progress";
export type { PercentageProgressBarProps, VolumeProgressBarProps } from "./components/progress";
export {
  RadioGroup,
  RadioGroupItem,
} from "./components/ui/radio-group";
export { Label } from "./components/ui/label";
export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "./components/select";
export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetOverlay,
  SheetPortal,
  SheetTitle,
  SheetTrigger,
} from "./components/ui/sheet";
export { Slider } from "./components/ui/slider";
export { Stepper } from "./components/ui/stepper";
export type { StepperProps } from "./components/ui/stepper";
export { Switch } from "./components/switch";
export { EmptyState } from "./components/surfaces/empty-state";
export { SectionIntro } from "./components/surfaces/section-intro";
export { StatePanel } from "./components/surfaces/state-panel";
export { SurfacePanel } from "./components/surfaces/surface-panel";
export {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "./components/table";
export { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/tabs";
export { TextField } from "./components/text-field";
export type { TextFieldProps } from "./components/text-field";
export { Textarea } from "./components/textarea";
export { UpdateGuard } from "./components/update-guard";
export type { UpdateGuardCopy, UpdateGuardProps } from "./components/update-guard";
export { CHART_COLORS, CHART_CSS_VARS } from "./constants/chart-colors";
export { useApiClient } from "./hooks/use-api-client";
export { useDebouncedValue } from "./hooks/use-debounced-value";
export { useFilterState } from "./hooks/use-filter-state";
export { useMediaQuery } from "./hooks/use-media-query";
export { useIsMobile } from "./hooks/use-mobile";
export type { SortDirection, SortField, SortOption } from "./hooks/sort.types";
export { copyToClipboard } from "./lib/clipboard";
export { createMemoryStorage } from "./lib/create-memory-storage";
export { OTP_LENGTH, normalizeOtp } from "./lib/auth";
export { cn } from "./lib/utils";
export { colors } from "./tokens/colors";
export {
  COLOR_MODE_ATTRIBUTE,
  COLOR_SYSTEM_ATTRIBUTE,
  colorSystems,
  colorTokenNames,
} from "./tokens/colors";
export { durations, easingWeb, translateDistances } from "./tokens/motion";
export { radii } from "./tokens/radii";
export { shadowsNative, shadowsWeb } from "./tokens/shadows";
export { contentWidths, spacing } from "./tokens/spacing";
export {
  fontFamilies,
  fontSizes,
  fontWeights,
  letterSpacing,
  lineHeights,
} from "./tokens/typography";
export type { ColorMode, ColorSystem, ColorToken } from "./tokens/colors";
export type { RadiusToken } from "./tokens/radii";
export type { ContentWidthToken, SpacingToken } from "./tokens/spacing";
export type { FontSizeToken, FontWeightToken } from "./tokens/typography";
export { registerUiTranslations, translateUi, UI_TRANSLATIONS_EN } from "./translations";

export interface HtmlLinkDescriptor {
  rel: string;
  href: string;
  type?: string;
  sizes?: string;
  color?: string;
}

export const COMMON_FONT_LINKS: HtmlLinkDescriptor[] = [];

export const COMMON_ICON_LINKS: HtmlLinkDescriptor[] = [
  { rel: "icon", type: "image/x-icon", href: "/icons/favicon.ico" },
  { rel: "icon", type: "image/png", sizes: "16x16", href: "/icons/favicon-16x16.png" },
  { rel: "icon", type: "image/png", sizes: "32x32", href: "/icons/favicon-32x32.png" },
  { rel: "icon", type: "image/png", sizes: "96x96", href: "/icons/favicon-96x96.png" },
  { rel: "apple-touch-icon", href: "/icons/apple-touch-icon.png" },
  { rel: "apple-touch-icon", sizes: "57x57", href: "/icons/apple-touch-icon-57x57.png" },
  { rel: "apple-touch-icon", sizes: "60x60", href: "/icons/apple-touch-icon-60x60.png" },
  { rel: "apple-touch-icon", sizes: "72x72", href: "/icons/apple-touch-icon-72x72.png" },
  { rel: "apple-touch-icon", sizes: "76x76", href: "/icons/apple-touch-icon-76x76.png" },
  { rel: "apple-touch-icon", sizes: "114x114", href: "/icons/apple-touch-icon-114x114.png" },
  { rel: "apple-touch-icon", sizes: "120x120", href: "/icons/apple-touch-icon-120x120.png" },
  { rel: "apple-touch-icon", sizes: "144x144", href: "/icons/apple-touch-icon-144x144.png" },
  { rel: "apple-touch-icon", sizes: "152x152", href: "/icons/apple-touch-icon-152x152.png" },
  { rel: "apple-touch-icon", sizes: "180x180", href: "/icons/apple-touch-icon-180x180.png" },
  { rel: "icon", type: "image/png", sizes: "36x36", href: "/icons/android-icon-36x36.png" },
  { rel: "icon", type: "image/png", sizes: "48x48", href: "/icons/android-icon-48x48.png" },
  { rel: "icon", type: "image/png", sizes: "72x72", href: "/icons/android-icon-72x72.png" },
  { rel: "icon", type: "image/png", sizes: "96x96", href: "/icons/android-icon-96x96.png" },
  { rel: "icon", type: "image/png", sizes: "144x144", href: "/icons/android-icon-144x144.png" },
  { rel: "icon", type: "image/png", sizes: "192x192", href: "/icons/android-icon-192x192.png" },
  { rel: "manifest", href: "/manifest.json" },
  { rel: "mask-icon", href: "/icons/safari-pinned-tab.svg", color: "#ffffff" },
];
