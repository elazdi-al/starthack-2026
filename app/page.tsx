"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HoldToDeleteExample } from "@/components/examples/hold-to-delete-example";
import { RunningWidgetExample } from "@/components/examples/running-widget-example";
import { TypographySpecimen } from "@/components/examples/typography-specimen";
import { WalletWidgetExample } from "@/components/examples/wallet-widget-example";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/ui/code-block";
import { HighlightTabs } from "@/components/ui/highlight-tabs";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Input } from "@/components/ui/input";
import { SearchBar } from "@/components/ui/search-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { DialRoot } from "dialkit";
import {
  AlignCenterVertical,
  AlignEndVertical,
  AlignStartVertical,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Ellipsis,
  Minus,
  PanelsTopLeft,
  Sparkles,
  SwatchBook,
} from "lucide-react";


function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="py-16">
      <div className="mb-8">
        <h2 className="type-section-heading text-foreground">
          {title}
        </h2>
        {description && (
          <p className="type-section-description mt-2 max-w-2xl text-[var(--dial-text-secondary)]">{description}</p>
        )}
      </div>
      {children}
    </section>
  );
}

function ComponentCard({
  title,
  mono,
  className,
  previewClassName,
  children,
}: {
  title: string;
  mono?: string;
  className?: string;
  previewClassName?: string;
  children: React.ReactNode;
}) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{title}</CardTitle>
          {mono && (
            <span className="text-[11px] font-mono text-muted-foreground">
              {mono}
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div
          className={cn(
            "ui-glass-row flex min-h-[120px] items-center justify-center rounded-[var(--dial-radius)] border-[var(--dial-border)] p-6",
            previewClassName
          )}
        >
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function ComponentsGlyph() {
  return (
    <svg
      aria-hidden="true"
      className="size-4"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M13.4141 2.24985C12.633 1.4688 11.3667 1.4688 10.5856 2.24985L8.49985 4.33564C7.7188 5.11669 7.7188 6.38302 8.49985 7.16406L10.5856 9.24985C11.3667 10.0309 12.633 10.0309 13.4141 9.24985L15.4999 7.16406C16.2809 6.38301 16.2809 5.11668 15.4998 4.33564L13.4141 2.24985Z"
        fill="currentColor"
      />
      <path
        d="M7.16406 8.49985C6.38301 7.7188 5.11668 7.7188 4.33564 8.49985L2.24985 10.5856C1.4688 11.3667 1.4688 12.633 2.24985 13.4141L4.33564 15.4999C5.11669 16.2809 6.38302 16.2809 7.16406 15.4998L9.24985 13.4141C10.0309 12.633 10.0309 11.3667 9.24985 10.5856L7.16406 8.49985Z"
        fill="currentColor"
      />
      <path
        d="M19.6641 8.49985C18.883 7.7188 17.6167 7.7188 16.8356 8.49985L14.7498 10.5856C13.9688 11.3667 13.9688 12.633 14.7498 13.4141L16.8356 15.4999C17.6167 16.2809 18.883 16.2809 19.6641 15.4998L21.7499 13.4141C22.5309 12.633 22.5309 11.3667 21.7498 10.5856L19.6641 8.49985Z"
        fill="currentColor"
      />
      <path
        d="M13.4141 14.7498C12.633 13.9688 11.3667 13.9688 10.5856 14.7498L8.49985 16.8356C7.7188 17.6167 7.7188 18.883 8.49985 19.6641L10.5856 21.7499C11.3667 22.5309 12.633 22.5309 13.4141 21.7498L15.4999 19.6641C16.2809 18.883 16.2809 17.6167 15.4998 16.8356L13.4141 14.7498Z"
        fill="currentColor"
      />
    </svg>
  );
}

function CourseArrowIcon() {
  return (
    <svg
      aria-hidden="true"
      className="h-3 w-3"
      viewBox="0 0 16 16"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M3 13L13 3M13 3H5M13 3V11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
const bloomInstallCommand = "npm install bloom-menu framer-motion";

export default function Home() {
  const siteHeaderLinks = [
    { label: "Demos", href: "/demo" },
    { label: "Skill", href: "/skill" },
    {
      label: "Twitter",
      href: "https://twitter.com/intent/follow?screen_name=raphaelsalaja",
    },
    {
      label: "Github",
      href: "https://github.com/raphaelsalaja/userinterface-wiki",
    },
  ];

  const utilityButtons = [
    {
      label: "Components",
      variant: "secondary" as const,
      icon: <ComponentsGlyph />,
    },
    {
      label: "Patterns",
      variant: "outline" as const,
      icon: <PanelsTopLeft className="size-4" />,
    },
    {
      label: "Tokens",
      variant: "secondary" as const,
      className: "bg-muted text-foreground hover:bg-muted/80",
      icon: <SwatchBook className="size-4" />,
    },
    {
      label: "Playground",
      variant: "ghost" as const,
      className: "text-muted-foreground hover:text-foreground",
      icon: <Sparkles className="size-4" />,
    },
  ];

  return (
    <div className="relative min-h-screen bg-background">
      <DialRoot position="top-right" />
      <SiteHeader links={siteHeaderLinks} />
      <main className="mx-auto max-w-3xl px-8">
        {/* Interactive Components */}
        <Section title="Interactive" description="Spring physics and glassmorphic surfaces.">
            <ComponentCard title="Search bar">
              <SearchBar
                suggestions={["who built this", "pricing details", "how to get started"]}
              />
            </ComponentCard>
        </Section>

        <Separator />

        <Section
          title="Code Blocks"
          description="Bloom-style snippets with a compact copy action and clean feedback."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ComponentCard
              title="Install command"
              mono="bloom-menu"
              className="sm:col-span-2"
              previewClassName="min-h-0 justify-stretch border-0 bg-transparent p-0 shadow-none"
            >
              <CodeBlock code={bloomInstallCommand} />
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        <Section
          title="Motion Studies"
          description="Reusable staged widgets with the same interaction pattern applied to different Apple-style surfaces."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <ComponentCard
              title="Wallet widget"
              mono="userinterface.wiki"
              previewClassName="min-h-0 justify-stretch overflow-visible border-0 bg-transparent p-0 shadow-none"
            >
              <WalletWidgetExample />
            </ComponentCard>
            <ComponentCard
              title="Running widget"
              mono="apple-style"
              previewClassName="min-h-0 justify-stretch overflow-visible border-0 bg-transparent p-0 shadow-none"
            >
              <RunningWidgetExample />
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        {/* Icon Action Buttons */}
        <Section title="Icon actions" description="Hold-to-confirm buttons with clip-path fill feedback.">
          <div className="grid gap-4 sm:grid-cols-1">
            <ComponentCard title="Colored actions">
              <div className="flex items-center gap-6">
                <IconActionButton
                  behavior="toggle"
                  label="Mute notifications"
                  color="orange"
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 2C7.7922 2 4.14828 5.17264 3.70001 9.35647L3.17536 12.9169C2.81947 15.3321 4.69133 17.5 7.13263 17.5H16.8674C19.3087 17.5 21.1806 15.3321 20.8247 12.9169L20.3 9.35648C19.8517 5.17264 16.2078 2 12 2Z" fill="currentColor" />
                      <path d="M16.5839 19H7.41602C8.18758 20.7659 9.94966 22 12 22C14.0503 22 15.8124 20.7659 16.5839 19Z" fill="currentColor" />
                    </svg>
                  }
                  activeIcon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3.70711 2.29289C3.31658 1.90237 2.68342 1.90237 2.29289 2.29289C1.90237 2.68342 1.90237 3.31658 2.29289 3.70711L4.74924 6.16346C4.19225 7.12001 3.82396 8.19958 3.70001 9.35647L3.17536 12.9169C2.81947 15.3321 4.69133 17.5 7.13263 17.5H16.0858L20.2929 21.7071C20.6834 22.0976 21.3166 22.0976 21.7071 21.7071C22.0976 21.3166 22.0976 20.6834 21.7071 20.2929L3.70711 2.29289Z" fill="currentColor" />
                      <path d="M20.8247 12.9169C21.0384 14.3676 20.4484 15.7292 19.414 16.5852L6.71002 3.88126C8.16591 2.70209 10.0206 2 12 2C16.2078 2 19.8517 5.17264 20.3 9.35648L20.8247 12.9169Z" fill="currentColor" />
                      <path d="M7.41602 19C8.18758 20.7659 9.94966 22 12 22C14.0503 22 15.8124 20.7659 16.5839 19H7.41602Z" fill="currentColor" />
                    </svg>
                  }
                />
                <IconActionButton
                  behavior="confirm"
                  label="Confirm"
                  color="blue"
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22C17.5228 22 22 17.5228 22 12ZM8.29289 10.2929C7.90237 10.6834 7.90237 11.3166 8.29289 11.7071C8.68342 12.0976 9.31658 12.0976 9.70711 11.7071L11 10.4142V16C11 16.5523 11.4477 17 12 17C12.5523 17 13 16.5523 13 16V10.4142L14.2929 11.7071C14.6834 12.0976 15.3166 12.0976 15.7071 11.7071C16.0976 11.3166 16.0976 10.6834 15.7071 10.2929L12.7071 7.29289C12.3166 6.90237 11.6834 6.90237 11.2929 7.29289L8.29289 10.2929Z" fill="currentColor" />
                    </svg>
                  }
                  activeIcon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22ZM13.7071 8.29289C13.3166 7.90237 12.6834 7.90237 12.2929 8.29289C11.9024 8.68342 11.9024 9.31658 12.2929 9.70711L13.5858 11H8C7.44772 11 7 11.4477 7 12C7 12.5523 7.44772 13 8 13H13.5858L12.2929 14.2929C11.9024 14.6834 11.9024 15.3166 12.2929 15.7071C12.6834 16.0976 13.3166 16.0976 13.7071 15.7071L16.7071 12.7071C17.0976 12.3166 17.0976 11.6834 16.7071 11.2929L13.7071 8.29289Z" fill="currentColor" />
                    </svg>
                  }
                />
                <IconActionButton
                  behavior="delete"
                  label="Delete Item"
                  color="red"
                  icon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M7.22919 5H3.5C2.94772 5 2.5 5.44772 2.5 6C2.5 6.55228 2.94772 7 3.5 7H4.03211L4.80971 18.2752C4.95435 20.3726 6.6979 22 8.80023 22H15.1998C17.3021 22 19.0456 20.3726 19.1903 18.2752L19.9679 7H20.5C21.0523 7 21.5 6.55228 21.5 6C21.5 5.44772 21.0523 5 20.5 5H16.7708C16.1335 2.97145 14.2395 1.5 12 1.5C9.76053 1.5 7.86655 2.97145 7.22919 5ZM9.40105 5H14.599C14.0801 4.10329 13.1099 3.5 12 3.5C10.8901 3.5 9.9199 4.10329 9.40105 5ZM10 10C10.5523 10 11 10.4477 11 11V16C11 16.5523 10.5523 17 10 17C9.44772 17 9 16.5523 9 16V11C9 10.4477 9.44772 10 10 10ZM14 10C14.5523 10 15 10.4477 15 11V16C15 16.5523 14.5523 17 14 17C13.4477 17 13 16.5523 13 16V11C13 10.4477 13.4477 10 14 10Z" fill="currentColor" />
                    </svg>
                  }
                  activeIcon={
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path fillRule="evenodd" clipRule="evenodd" d="M12 1.5C14.2394 1.5 16.1331 2.9715 16.7705 5H20.5C21.0523 5 21.5 5.44772 21.5 6C21.5 6.55228 21.0523 7 20.5 7H19.9678L19.1904 18.2754C19.0457 20.3725 17.3023 21.9998 15.2002 22H8.7998C6.69772 21.9998 4.95429 20.3725 4.80957 18.2754L4.03223 7H3.5C2.94772 7 2.5 6.55228 2.5 6C2.5 5.44772 2.94772 5 3.5 5H7.22949C7.86688 2.9715 9.76056 1.5 12 1.5ZM10.6309 10.2246C10.2381 9.90426 9.65908 9.92685 9.29297 10.293C8.92685 10.6591 8.90426 11.2381 9.22461 11.6309L9.29297 11.707L10.5859 13L9.29297 14.293C8.90244 14.6835 8.90244 15.3165 9.29297 15.707C9.68349 16.0976 10.3165 16.0976 10.707 15.707L12 14.4141L13.293 15.707L13.3691 15.7754C13.7619 16.0957 14.3409 16.0731 14.707 15.707C15.0731 15.3409 15.0957 14.7619 14.7754 14.3691L14.707 14.293L13.4141 13L14.707 11.707L14.7754 11.6309C15.0957 11.2381 15.0731 10.6591 14.707 10.293C14.3409 9.92685 13.7619 9.90426 13.3691 10.2246L13.293 10.293L12 11.5859L10.707 10.293L10.6309 10.2246ZM12 3.5C10.8902 3.5 9.92023 4.10337 9.40137 5H14.5986C14.0798 4.10337 13.1098 3.5 12 3.5Z" fill="currentColor" />
                    </svg>
                  }
                />
              </div>
            </ComponentCard>
            <ComponentCard title="Hold to delete" mono="emilkowal.ski">
              <HoldToDeleteExample />
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        {/* Segmented Controls */}
        <Section title="Segmented controls" description="Compact icon toggles with animated sliding indicator.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ComponentCard title="Direction & alignment">
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  indicatorId="direction"
                  defaultValue="up"
                  options={[
                    { value: "up", label: "Expand up", icon: <ArrowUp className="h-4 w-4" /> },
                    { value: "down", label: "Expand down", icon: <ArrowDown className="h-4 w-4" /> },
                    { value: "left", label: "Expand left", icon: <ArrowLeft className="h-4 w-4" /> },
                    { value: "right", label: "Expand right", icon: <ArrowRight className="h-4 w-4" /> },
                  ]}
                />
                <SegmentedControl
                  indicatorId="alignment"
                  defaultValue="center"
                  options={[
                    { value: "start", label: "Align to start", icon: <AlignStartVertical className="h-4 w-4" /> },
                    { value: "center", label: "Align to center", icon: <AlignCenterVertical className="h-4 w-4" /> },
                    { value: "end", label: "Align to end", icon: <AlignEndVertical className="h-4 w-4" /> },
                  ]}
                />
              </div>
            </ComponentCard>
            <ComponentCard title="Binary toggles">
              <div className="flex flex-wrap items-center gap-2">
                <SegmentedControl
                  indicatorId="submenu"
                  defaultValue="none"
                  options={[
                    { value: "none", label: "No submenu", icon: <Minus className="h-4 w-4" /> },
                    { value: "submenu", label: "With submenu", icon: <ChevronRight className="h-4 w-4" /> },
                  ]}
                />
                <SegmentedControl
                  indicatorId="trigger"
                  defaultValue="icon"
                  options={[
                    { value: "icon", label: "Icon trigger", icon: <Ellipsis className="h-4 w-4" /> },
                    { value: "text", label: "Text trigger", icon: <span className="type-caption leading-none">Aa</span> },
                  ]}
                />
              </div>
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        {/* Buttons */}
        <Section
          title="Buttons"
          description="Core shadcn actions plus rounded utility pills built on the same base."
        >
          <div className="flex flex-col gap-4">
            <ComponentCard title="Core actions">
              <div className="flex w-full flex-col items-center gap-4">
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  <Button>Default</Button>
                  <Button variant="outline">Outline</Button>
                  <Button variant="secondary">Secondary</Button>
                  <Button variant="ghost">Ghost</Button>
                  <Button variant="destructive">Destructive</Button>
                  <Button variant="link">Link</Button>
                </div>
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  <Button size="xs">XS</Button>
                  <Button size="sm">Small</Button>
                  <Button>Default</Button>
                  <Button size="lg">Large</Button>
                </div>
              </div>
            </ComponentCard>
            <ComponentCard title="Utility pills">
              <div className="flex w-full flex-col items-center gap-4">
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  {utilityButtons.map((button) => (
                    <Button
                      key={button.label}
                      variant={button.variant}
                      className={cn("gap-2", button.className)}
                    >
                      {button.icon}
                      {button.label}
                    </Button>
                  ))}
                </div>
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  <Button variant="secondary" size="xs" className="gap-2">
                    <ComponentsGlyph />
                    Compact
                  </Button>
                  <Button variant="secondary" size="sm" className="gap-2">
                    <ComponentsGlyph />
                    Small
                  </Button>
                  <Button variant="secondary" className="gap-2">
                    <ComponentsGlyph />
                    Default
                  </Button>
                  <Button variant="secondary" size="lg" className="gap-2">
                    <ComponentsGlyph />
                    Large
                  </Button>
                </div>
                <div className="flex w-full flex-wrap items-center justify-center gap-2">
                  <Button
                    variant="course"
                    nativeButton={false}
                    render={
                      <a
                        href="https://animations.dev"
                        target="_blank"
                        rel="noreferrer"
                      />
                    }
                  >
                    Take the course
                    <CourseArrowIcon />
                  </Button>
                </div>
              </div>
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        {/* Form Controls */}
        <Section title="Form controls" description="Inputs, toggles, and selections.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ComponentCard title="Input">
              <div className="w-full max-w-[220px] flex flex-col gap-3">
                <Input placeholder="Email address" type="email" />
                <Input placeholder="Disabled" disabled />
              </div>
            </ComponentCard>
            <ComponentCard title="Switch">
              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <Switch defaultChecked />
                  <span className="type-small-strong text-[var(--dial-text-secondary)]">Enabled</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch />
                  <span className="type-small-strong text-[var(--dial-text-secondary)]">Disabled</span>
                </div>
                <div className="flex items-center gap-3">
                  <Switch size="sm" defaultChecked />
                  <span className="type-small-strong text-[var(--dial-text-secondary)]">Small</span>
                </div>
              </div>
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        {/* Tabs */}
        <Section title="Tabs" description="Segmented, underline, and animated highlight styles.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ComponentCard title="Default tabs">
              <Tabs defaultValue="design">
                <TabsList>
                  <TabsTrigger value="design">Design</TabsTrigger>
                  <TabsTrigger value="code">Code</TabsTrigger>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                </TabsList>
                <TabsContent value="design">
                  <p className="type-caption pt-3 text-[var(--dial-text-label)]">Visual design tools and tokens.</p>
                </TabsContent>
                <TabsContent value="code">
                  <p className="type-caption pt-3 text-[var(--dial-text-label)]">Source code and implementations.</p>
                </TabsContent>
                <TabsContent value="preview">
                  <p className="type-caption pt-3 text-[var(--dial-text-label)]">Live component previews.</p>
                </TabsContent>
              </Tabs>
            </ComponentCard>
            <ComponentCard title="Line tabs">
              <Tabs defaultValue="overview">
                <TabsList variant="line">
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="usage">Usage</TabsTrigger>
                  <TabsTrigger value="api">API</TabsTrigger>
                </TabsList>
                <TabsContent value="overview">
                  <p className="type-caption pt-3 text-[var(--dial-text-label)]">Component overview and anatomy.</p>
                </TabsContent>
                <TabsContent value="usage">
                  <p className="type-caption pt-3 text-[var(--dial-text-label)]">Usage guidelines and examples.</p>
                </TabsContent>
                <TabsContent value="api">
                  <p className="type-caption pt-3 text-[var(--dial-text-label)]">Props and configuration.</p>
                </TabsContent>
              </Tabs>
            </ComponentCard>
            <ComponentCard
              title="Highlight tabs"
              mono="seamless color transition"
              className="sm:col-span-2"
              previewClassName="min-h-[22rem] p-4 md:p-6"
            >
              <HighlightTabs
                defaultValue="payments"
                items={[
                  {
                    value: "payments",
                    label: "Payments",
                    icon: (
                      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M0 3.884c0-.8.545-1.476 1.306-1.68l.018-.004L10.552.213c.15-.038.3-.055.448-.055.927.006 1.75.733 1.75 1.74V4.5h.75A2.5 2.5 0 0 1 16 7v6.5a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 0 13.5V3.884ZM10.913 1.67c.199-.052.337.09.337.23v2.6H2.5c-.356 0-.694.074-1 .208v-.824c0-.092.059-.189.181-.227l9.216-1.984.016-.004ZM1.5 7v6.5a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V7a1 1 0 0 0-1-1h-11a1 1 0 0 0-1 1Z" />
                        <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M13 10.25c0 .688-.563 1.25-1.25 1.25-.688 0-1.25-.55-1.25-1.25 0-.688.563-1.25 1.25-1.25.688 0 1.25.562 1.25 1.25Z" />
                      </svg>
                    ),
                  },
                  {
                    value: "balances",
                    label: "Balances",
                    icon: (
                      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill="currentColor" d="M1 2a.75.75 0 0 1 .75-.75h7.5a.75.75 0 0 1 0 1.5h-7.5A.75.75 0 0 1 1 2Zm0 8a.75.75 0 0 1 .75-.75h5a.75.75 0 0 1 0 1.5h-5A.75.75 0 0 1 1 10Zm2.25-4.75a.75.75 0 0 0 0 1.5h7.5a.75.75 0 0 0 0-1.5h-7.5ZM2.5 14a.75.75 0 0 1 .75-.75h4a.75.75 0 0 1 0 1.5h-4A.75.75 0 0 1 2.5 14Z" />
                        <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M16 11.5a3.5 3.5 0 1 1-7 0 3.5 3.5 0 0 1 7 0Zm-1.5 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z" />
                      </svg>
                    ),
                  },
                  {
                    value: "customers",
                    label: "Customers",
                    hiddenOnMobile: true,
                    icon: (
                      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fillRule="evenodd" clipRule="evenodd" fill="currentColor" d="M2.5 14.4h11a.4.4 0 0 0 .4-.4 3.4 3.4 0 0 0-3.4-3.4h-5A3.4 3.4 0 0 0 2.1 14c0 .22.18.4.4.4Zm0 1.6h11a2 2 0 0 0 2-2 5 5 0 0 0-5-5h-5a5 5 0 0 0-5 5 2 2 0 0 0 2 2ZM8 6.4a2.4 2.4 0 1 0 0-4.8 2.4 2.4 0 0 0 0 4.8ZM8 8a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" />
                      </svg>
                    ),
                  },
                  {
                    value: "billing",
                    label: "Billing",
                    icon: (
                      <svg aria-hidden width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path fill="currentColor" d="M0 2.25A2.25 2.25 0 0 1 2.25 0h7.5A2.25 2.25 0 0 1 12 2.25v6a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 0-.75-.75h-7.5a.75.75 0 0 0-.75.75v10.851a.192.192 0 0 0 .277.172l.888-.444a.75.75 0 1 1 .67 1.342l-.887.443A1.69 1.69 0 0 1 0 13.101V2.25Z" />
                        <path fill="currentColor" d="M5 10.7a.7.7 0 0 1 .7-.7h4.6a.7.7 0 1 1 0 1.4H7.36l.136.237c.098.17.193.336.284.491.283.483.554.907.855 1.263.572.675 1.249 1.109 2.365 1.109 1.18 0 2.038-.423 2.604-1.039.576-.626.896-1.5.896-2.461 0-.99-.42-1.567-.807-1.998a.75.75 0 1 1 1.115-1.004C15.319 8.568 16 9.49 16 11c0 1.288-.43 2.54-1.292 3.476C13.838 15.423 12.57 16 11 16c-1.634 0-2.706-.691-3.51-1.64-.386-.457-.71-.971-1.004-1.472L6.4 12.74v2.56a.7.7 0 1 1-1.4 0v-4.6ZM2.95 4.25a.75.75 0 0 1 .75-.75h2a.75.75 0 0 1 0 1.5h-2a.75.75 0 0 1-.75-.75ZM3.7 6.5a.75.75 0 0 0 0 1.5h4.6a.75.75 0 0 0 0-1.5H3.7Z" />
                      </svg>
                    ),
                  },
                ]}
              />
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        {/* Badges & Avatars */}
        <Section title="Data display" description="Badges, avatars, and status indicators.">
          <div className="grid gap-4 sm:grid-cols-2">
            <ComponentCard title="Badges">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>Default</Badge>
                <Badge variant="secondary">Secondary</Badge>
                <Badge variant="outline">Outline</Badge>
                <Badge variant="destructive">Error</Badge>
              </div>
            </ComponentCard>
            <ComponentCard title="Avatars">
              <div className="flex flex-col items-center gap-4">
                <AvatarGroup>
                  <Avatar>
                    <AvatarFallback>JP</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>AK</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>ML</AvatarFallback>
                  </Avatar>
                </AvatarGroup>
                <div className="flex items-center gap-2">
                  <Avatar size="sm">
                    <AvatarFallback>S</AvatarFallback>
                  </Avatar>
                  <Avatar>
                    <AvatarFallback>M</AvatarFallback>
                  </Avatar>
                  <Avatar size="lg">
                    <AvatarFallback>L</AvatarFallback>
                  </Avatar>
                </div>
              </div>
            </ComponentCard>
          </div>
        </Section>


        <Separator />

        {/* Accordion / FAQ */}
        <Section title="Accordion" description="Collapsible content panels for FAQ and disclosure patterns.">
          <div className="grid gap-4 sm:grid-cols-1">
            <ComponentCard title="FAQ">
              <div className="w-full max-w-lg">
                <Accordion>
                  <AccordionItem value="enrichment">
                    <AccordionTrigger>
                      What&apos;s the difference between basic and advanced enrichment?
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="type-small text-[var(--dial-text-secondary)]">
                        Basic enrichment extracts metadata like titles, descriptions, and thumbnails.
                        Advanced enrichment goes further by summarizing full page content, extracting
                        key entities, and generating semantic tags for better search and discovery.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="subscriptions">
                    <AccordionTrigger>
                      What are feed and channel subscriptions?
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="type-small text-[var(--dial-text-secondary)]">
                        Subscriptions let you automatically save new content from RSS feeds, YouTube
                        channels, newsletters, and other sources. New items are enriched and added
                        to your library as they appear.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="bookmarks">
                    <AccordionTrigger>
                      How does the X bookmarks sync work?
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="type-small text-[var(--dial-text-secondary)]">
                        Once connected, your X bookmarks are periodically synced and enriched.
                        Each bookmark is saved with its full thread context, media, and metadata
                        so you can search and organize them alongside everything else.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                  <AccordionItem value="links">
                    <AccordionTrigger>
                      What kinds of links can the library save and enrich?
                    </AccordionTrigger>
                    <AccordionContent>
                      <p className="type-small text-[var(--dial-text-secondary)]">
                        The library can save most kinds of links, but there will always be edge
                        cases: if a website opts out of programmatic access, or if content is gated
                        behind a paywall, the app will not be able to view the page. In some cases,
                        websites with poorly formatted HTML or incredibly long page content may not
                        be captured in full.
                      </p>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </ComponentCard>
          </div>
        </Section>

        <Separator />

        {/* Typography */}
        <Section
          title="Typography"
          description="A single variable sans stack now drives display, headers, body copy, and compact UI labels across the system."
        >
          <ComponentCard title="Typography">
            <TypographySpecimen />
          </ComponentCard>
        </Section>

        <Separator />

        {/* Colors */}
        <Section title="Colors" description="Neutral glass palette with translucent layers and soft borders.">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { name: "Background", var: "--background" },
              { name: "Foreground", var: "--foreground" },
              { name: "Card", var: "--card" },
              { name: "Muted", var: "--muted" },
              { name: "Primary", var: "--primary" },
              { name: "Secondary", var: "--secondary" },
              { name: "Border", var: "--border" },
              { name: "Destructive", var: "--destructive" },
            ].map((color) => (
              <div key={color.name} className="flex items-center gap-2.5">
                <div
                  className="h-6 w-6 shrink-0 rounded-md ring-1 ring-border"
                  style={{ background: `var(${color.var})` }}
                />
                <div>
                  <p className="type-caption text-foreground/80">{color.name}</p>
                  <p className="text-[10px] font-mono text-muted-foreground">{color.var}</p>
                </div>
              </div>
            ))}
          </div>
        </Section>
      </main>

      <footer className="border-t border-border/50 px-8 py-5 mt-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <p className="type-caption text-muted-foreground">
            shadcn/ui + Bloom Menu + DialKit
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">2026</p>
        </div>
      </footer>
    </div>
  );
}
