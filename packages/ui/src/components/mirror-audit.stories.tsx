import type { Meta, StoryObj } from "@storybook/react-vite";
import { MessageCircle, Settings } from "lucide-react";
import * as React from "react";

import {
  ActiveFiltersBar,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
  AuthScaffold,
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
  Button,
  Calendar,
  DatePicker,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  EmailEntryForm,
  FilterControls,
  FilterSelect,
  InboxStreamRow,
  OtpVerificationForm,
  PasskeyManagement,
  Switch,
  UpdateGuard,
} from "../index";

const meta: Meta = {
  title: "Audit/Mirror Components",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-border bg-surface space-y-4 rounded-xl border p-5">
      <div className="text-text-primary text-sm font-semibold">{title}</div>
      {children}
    </section>
  );
}

function MirrorAuditCanvas() {
  const [email, setEmail] = React.useState("studio@ponti.so");
  const [otp, setOtp] = React.useState("12");
  const [date, setDate] = React.useState<Date | undefined>(new Date());
  const [status, setStatus] = React.useState(true);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [filterValue, setFilterValue] = React.useState<"open" | "closed" | "flagged" | "">("open");
  const [filters, setFilters] = React.useState([
    { id: "status", label: "Status: Open" },
    { id: "owner", label: "Owner: Studio" },
  ]);

  return (
    <UpdateGuard hideInDev={false} hasStaleData>
      <div className="bg-base min-h-screen p-8">
        <div className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-2">
          <Section title="Primitives">
            <div className="flex flex-wrap items-center gap-4">
              <Avatar statusBadge>
                <AvatarImage src="https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=120&h=120&fit=crop&crop=faces" />
                <AvatarFallback>CP</AvatarFallback>
              </Avatar>
              <AvatarGroup size="lg">
                <Avatar>
                  <AvatarFallback>AL</AvatarFallback>
                </Avatar>
                <Avatar>
                  <AvatarFallback>MP</AvatarFallback>
                </Avatar>
                <AvatarGroupCount>+4</AvatarGroupCount>
              </AvatarGroup>
              <div className="flex items-center gap-2">
                <Switch checked={status} onCheckedChange={setStatus} />
                <span className="text-text-secondary text-sm">
                  {status ? "Enabled" : "Disabled"}
                </span>
              </div>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline">Menu</Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem>
                    <Settings className="size-4" />
                    Preferences
                  </DropdownMenuItem>
                  <DropdownMenuItem variant="destructive">Delete</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </Section>

          <Section title="Dialogs And Drawers">
            <div className="flex flex-wrap gap-3">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <Button onClick={() => setDialogOpen(true)}>Open dialog</Button>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Dialogue surface</DialogTitle>
                    <DialogDescription>Generic dialog APIs now live in Labs UI.</DialogDescription>
                  </DialogHeader>
                </DialogContent>
              </Dialog>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline">Open alert</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Confirm action</AlertDialogTitle>
                    <AlertDialogDescription>
                      This alert dialog is now shared from the master package.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction>Continue</AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
                <Button variant="secondary" onClick={() => setDrawerOpen(true)}>
                  Open drawer
                </Button>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>Drawer title</DrawerTitle>
                    <DrawerDescription>
                      Directional drawer behavior is portable now too.
                    </DrawerDescription>
                  </DrawerHeader>
                </DrawerContent>
              </Drawer>
            </div>
          </Section>

          <Section title="Calendar And Filters">
            <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
              <Calendar mode="single" selected={date} onSelect={setDate} />
              <div className="space-y-4">
                <DatePicker value={date} onSelect={setDate} label="Schedule date" />
                <FilterControls
                  showActiveFilters
                  activeFilters={filters.map((filter) => ({
                    ...filter,
                    onRemove: () =>
                      setFilters((current) => current.filter((item) => item.id !== filter.id)),
                  }))}
                >
                  <FilterSelect
                    label="Status"
                    value={filterValue}
                    onChange={setFilterValue}
                    options={[
                      { value: "open", label: "Open" },
                      { value: "closed", label: "Closed" },
                      { value: "flagged", label: "Flagged" },
                    ]}
                  />
                </FilterControls>
                <ActiveFiltersBar
                  label="Applied"
                  filters={filters.map((filter) => ({
                    ...filter,
                    onRemove: () =>
                      setFilters((current) => current.filter((item) => item.id !== filter.id)),
                  }))}
                />
              </div>
            </div>
          </Section>

          <Section title="Auth">
            <div className="grid gap-6 lg:grid-cols-2">
              <AuthScaffold title="Sign in" helperText="Enter your email to continue.">
                <EmailEntryForm
                  email={email}
                  onEmailChange={setEmail}
                  onSubmit={() => undefined}
                  onPasskeyClick={() => undefined}
                />
              </AuthScaffold>

              <AuthScaffold title="Verify" helperText={`Code sent to ${email}.`}>
                <OtpVerificationForm
                  email={email}
                  otp={otp}
                  onOtpChange={setOtp}
                  onSubmit={() => undefined}
                  onResend={() => undefined}
                  onChangeEmail={() => setOtp("")}
                />
              </AuthScaffold>
            </div>
          </Section>

          <Section title="Passkeys And Inbox">
            <div className="grid gap-6 lg:grid-cols-2">
              <PasskeyManagement
                passkeys={[
                  { id: "pk_1", name: "MacBook Pro", createdAt: "2026-06-28T12:00:00.000Z" },
                  { id: "pk_2", name: "iPhone", createdAt: "2026-06-29T12:00:00.000Z" },
                ]}
                onAdd={async () => true}
                onDelete={async () => true}
              />

              <div className="border-border bg-surface overflow-hidden rounded-xl border">
                <InboxStreamRow
                  item={{
                    kind: "chat",
                    entityId: "c_1",
                    title: "Studio approvals",
                    preview: "Need sign-off on the next release pass.",
                    updatedAt: new Date().toISOString(),
                  }}
                  renderLink={({ children, className, href }) => (
                    <a href={href} className={className}>
                      {children}
                    </a>
                  )}
                />
                <InboxStreamRow
                  item={{
                    kind: "note",
                    entityId: "n_1",
                    preview: "Drafted a generic migration checklist for the mirror package.",
                    updatedAt: new Date(Date.now() - 86400000).toISOString(),
                  }}
                  renderLink={({ children, className, href }) => (
                    <a href={href} className={className}>
                      {children}
                    </a>
                  )}
                />
                <div className="text-text-tertiary px-4 py-3 text-xs">
                  <MessageCircle className="mr-2 inline size-3" />
                  Generic item rendering replaces router-coupled inbox logic.
                </div>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </UpdateGuard>
  );
}

export const Audit: Story = {
  render: () => <MirrorAuditCanvas />,
};
