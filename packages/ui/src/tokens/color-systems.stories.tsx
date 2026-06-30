import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";

import {
  AppNavigation,
  type AppNavigationRenderLinkArgs,
} from "../components/compound/app-navigation";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Slider } from "../components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { colorTokenNames } from "./colors";

const meta: Meta = {
  title: "Tokens/Color Systems Audit",
  parameters: {
    layout: "fullscreen",
  },
};

export default meta;

type Story = StoryObj<typeof meta>;
type AuditMode = "light" | "dark";
type AuditSystem = "primer" | "apple";

const combos: Array<{ system: AuditSystem; mode: AuditMode }> = [
  { system: "primer", mode: "light" },
  { system: "primer", mode: "dark" },
  { system: "apple", mode: "light" },
  { system: "apple", mode: "dark" },
];

const tokenGroups = colorTokenNames.reduce<Array<Array<string>>>((groups, token, index) => {
  const groupIndex = Math.floor(index / 6);
  groups[groupIndex] ??= [];
  groups[groupIndex].push(token);
  return groups;
}, []);

function renderLink({ href, className, onClick, children }: AppNavigationRenderLinkArgs) {
  return (
    <a href={href} className={className} onClick={onClick}>
      {children}
    </a>
  );
}

function swatchStyle(token: string): React.CSSProperties {
  return {
    background: `var(--color-${token})`,
    color:
      token.includes("foreground") || token.startsWith("text-")
        ? `var(--color-${token})`
        : undefined,
  };
}

function TokenSwatch({ token }: { token: string }) {
  return (
    <div style={{ display: "grid", gap: 6 }}>
      <div
        style={{
          height: 56,
          borderRadius: 14,
          border: "1px solid var(--color-border-default)",
          boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
          ...swatchStyle(token),
        }}
      />
      <div
        style={{
          fontFamily: "var(--font-family-mono)",
          fontSize: 11,
          lineHeight: 1.35,
          color: "var(--color-text-secondary)",
          wordBreak: "break-word",
        }}
      >
        {token}
      </div>
    </div>
  );
}

function ThemePanel({ system, mode }: { system: AuditSystem; mode: AuditMode }) {
  const tokenSet = new Set<string>(colorTokenNames);

  return (
    <section
      data-color-system={system}
      data-color-mode={mode}
      style={{
        colorScheme: mode,
        background:
          "radial-gradient(circle at top left, var(--color-bg-overlay), transparent 32%), var(--color-bg-base)",
        color: "var(--color-text-primary)",
        border: "1px solid var(--color-border-default)",
        borderRadius: 28,
        padding: 18,
        display: "grid",
        gap: 18,
        minWidth: 0,
      }}
    >
      <div style={{ display: "grid", gap: 14 }}>
        <AppNavigation
          brand="Labs"
          brandHref="/"
          activeHref="/tokens"
          links={[
            { href: "/overview", label: "Overview" },
            { href: "/tokens", label: "Tokens" },
          ]}
          cta={{ href: "/launch", label: "Launch", variant: "outline" }}
          renderLink={renderLink}
        />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            paddingTop: 72,
          }}
        >
          <div>
            <div
              style={{
                fontFamily: "var(--font-family-mono)",
                fontSize: 11,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--color-text-secondary)",
              }}
            >
              {system} / {mode}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, marginTop: 4 }}>Theme Audit</div>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Badge variant="default">Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="outline">Outline</Badge>
            <Badge variant="destructive">Destructive</Badge>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 16,
        }}
      >
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Core components</CardTitle>
              <CardDescription>Surface, text, inputs, tabs, tables, and actions.</CardDescription>
            </div>
          </CardHeader>
          <CardContent style={{ display: "grid", gap: 16 }}>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Button variant="default">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="outline">Outline</Button>
              <Button variant="destructive">Delete</Button>
            </div>

            <div style={{ display: "grid", gap: 10 }}>
              <Input placeholder="Search tokens" />
              <Slider defaultValue={[62]} max={100} step={1} />
            </div>

            <Tabs defaultValue="overview">
              <TabsList>
                <TabsTrigger value="overview">Overview</TabsTrigger>
                <TabsTrigger value="detail">Detail</TabsTrigger>
              </TabsList>
              <TabsContent value="overview">
                <div
                  style={{
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: 12,
                    padding: 12,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Active tabs, muted copy, and bordered content should remain legible.
                </div>
              </TabsContent>
              <TabsContent value="detail">
                <div
                  style={{
                    border: "1px solid var(--color-border-subtle)",
                    borderRadius: 12,
                    padding: 12,
                    color: "var(--color-text-secondary)",
                  }}
                >
                  Secondary surface treatment uses the same token set.
                </div>
              </TabsContent>
            </Tabs>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Token</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Value</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell>Primary action</TableCell>
                  <TableCell>Ready</TableCell>
                  <TableCell>Mapped</TableCell>
                </TableRow>
                <TableRow data-state="selected">
                  <TableCell>Interactive ring</TableCell>
                  <TableCell>Visible</TableCell>
                  <TableCell>Scoped</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </CardContent>
          <CardFooter style={{ justifyContent: "space-between" }}>
            <span style={{ color: "var(--color-text-secondary)", fontSize: 12 }}>
              {tokenSet.size} tokens in this system
            </span>
            <Button variant="ghost">Inspect</Button>
          </CardFooter>
        </Card>

        <Card>
          <CardHeader>
            <div>
              <CardTitle>Semantic swatches</CardTitle>
              <CardDescription>Quick comparison of high-value product roles.</CardDescription>
            </div>
          </CardHeader>
          <CardContent
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: 12,
            }}
          >
            {["bg-base", "text-primary", "primary", "accent", "destructive", "chart-2"].map(
              (token) => (
                <TokenSwatch key={token} token={token} />
              ),
            )}
          </CardContent>
        </Card>
      </div>

      <div style={{ display: "grid", gap: 14 }}>
        {tokenGroups.map((group, index) => (
          <div
            key={index}
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))`,
              gap: 12,
            }}
          >
            {group.map((token) => (
              <TokenSwatch key={token} token={token} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export const FourUpAudit: Story = {
  render: () => (
    <div
      style={{
        minHeight: "100vh",
        padding: 20,
        background: "#0b0b0d",
      }}
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: 18,
        }}
      >
        {combos.map((combo) => (
          <ThemePanel
            key={`${combo.system}-${combo.mode}`}
            system={combo.system}
            mode={combo.mode}
          />
        ))}
      </div>
    </div>
  ),
};
