"use client";

<<<<<<< HEAD
import * as React from "react";
import type { CSSProperties } from "react";
=======
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
import { CentralControlRoot } from "@/components/ui/central-control";
import { CentralControlExample } from "@/components/examples/central-control-example";
import { ColorSelectorExample } from "@/components/examples/color-selector-example";
import { HoldToDeleteExample } from "@/components/examples/hold-to-delete-example";
import { ExplodingInputExample } from "@/components/examples/exploding-input-example";
import { RunningWidgetExample } from "@/components/examples/running-widget-example";
import { SwitchExample } from "@/components/examples/switch-example";
import { TypographySpecimen } from "@/components/examples/typography-specimen";
import { WalletWidgetExample } from "@/components/examples/wallet-widget-example";
import {
  ArrowRightCircleIcon,
  ArrowUpCircleIcon,
  BalancesIcon,
  BillingIcon,
  ComponentsGlyphIcon,
  CourseArrowIcon,
  CustomersIcon,
  DeleteActionActiveIcon,
  DeleteActionIcon,
  NotificationBellIcon,
  NotificationBellMutedIcon,
  PaymentsIcon,
} from "@/components/icons";
import { SiteHeader } from "@/components/layout/site-header";
import { CodeBlock } from "@/components/ui/code-block";
import { FilterBar } from "@/components/ui/filter-bar";
import { HighlightTabs } from "@/components/ui/highlight-tabs";
import { IconActionButton } from "@/components/ui/icon-action-button";
import { Input } from "@/components/ui/input";
import { SearchBar } from "@/components/ui/search-bar";
import { SegmentedControl } from "@/components/ui/segmented-control";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  AlignBottomSimple,
  AlignCenterVerticalSimple,
  AlignTopSimple,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CaretRight,
  DotsThree,
  Layout,
  Minus,
  Sparkle,
  Swatches,
  TextAa,
} from "@phosphor-icons/react";
>>>>>>> aca35ad (feat: add central control)

import { ClockWidget } from "@/components/interface/clock-widget";
import { SettingsButton } from "@/components/interface/settings-button";
import { TemperatureWidget } from "@/components/interface/temperature-widget";
import { SidebarToggle } from "@/components/interface/sidebar-toggle";
import { SpeedSelector } from "@/components/interface/speed-selector";

const lightModeVars = {
  "--background": "#ffffff",
  "--foreground": "rgb(23 23 23)",
  "--accent": "rgb(0 0 0 / 0.06)",
  "--dial-text-primary": "rgb(23 23 23)",
  "--dial-text-secondary": "rgb(82 82 91)",
  "--icon-strong": "rgba(17, 24, 39, 0.92)",
  "--icon-muted": "rgba(17, 24, 39, 0.76)",
  "--icon-subtle": "rgba(17, 24, 39, 0.52)",
} as CSSProperties;

export default function Home() {
  const [speed, setSpeed] = React.useState("x1");
  const [sidebarOpen, setSidebarOpen] = React.useState(false);

  return (
<<<<<<< HEAD
    <main
      className="relative min-h-screen bg-background text-foreground"
      style={lightModeVars}
    >
      <div className="absolute left-6 top-6 flex items-center gap-2">
        <ClockWidget />
        <TemperatureWidget />
      </div>

      <div className="absolute right-6 top-6 flex items-center gap-3">
        <SpeedSelector value={speed} onValueChange={setSpeed} />
        <SidebarToggle
          pressed={sidebarOpen}
          onPressedChange={setSidebarOpen}
        />
      </div>

      <div className="absolute bottom-6 left-6">
        <SettingsButton />
      </div>
    </main>
=======
    <div className="relative min-h-screen bg-background">
      <CentralControlExample />
      <CentralControlRoot position="top-right" defaultOpen={false} />
      <SiteHeader links={siteHeaderLinks} />
      <main className="mx-auto max-w-3xl px-8">
        {/* Interactive Components */}
        <Section title="Interactive" description="Spring physics and glassmorphic surfaces.">
          <div className="grid gap-4">
            <ComponentCard title="Search bar">
              <SearchBar
                suggestions={["who built this", "pricing details", "how to get started"]}
              />
            </ComponentCard>
            <ComponentCard
              title="Username input"
              mono="spell.sh"
              previewClassName="items-start justify-center"
            >
              <ExplodingInputExample />
            </ComponentCard>
          </div>
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
                  icon={<NotificationBellIcon />}
                  activeIcon={<NotificationBellMutedIcon />}
                />
                <IconActionButton
                  behavior="confirm"
                  label="Confirm"
                  color="blue"
                  icon={<ArrowUpCircleIcon />}
                  activeIcon={<ArrowRightCircleIcon />}
                />
                <IconActionButton
                  behavior="delete"
                  label="Delete Item"
                  color="red"
                  icon={<DeleteActionIcon />}
                  activeIcon={<DeleteActionActiveIcon />}
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
                    { value: "up", label: "Expand up", icon: <ArrowUp className={segmentedIconClassName} weight="bold" /> },
                    { value: "down", label: "Expand down", icon: <ArrowDown className={segmentedIconClassName} weight="bold" /> },
                    { value: "left", label: "Expand left", icon: <ArrowLeft className={segmentedIconClassName} weight="bold" /> },
                    { value: "right", label: "Expand right", icon: <ArrowRight className={segmentedIconClassName} weight="bold" /> },
                  ]}
                />
                <SegmentedControl
                  indicatorId="alignment"
                  defaultValue="center"
                  options={[
                    { value: "start", label: "Align to start", icon: <AlignTopSimple className={segmentedIconClassName} weight="bold" /> },
                    { value: "center", label: "Align to center", icon: <AlignCenterVerticalSimple className={segmentedIconClassName} weight="bold" /> },
                    { value: "end", label: "Align to end", icon: <AlignBottomSimple className={segmentedIconClassName} weight="bold" /> },
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
                    { value: "none", label: "No submenu", icon: <Minus className={segmentedIconClassName} weight="bold" /> },
                    { value: "submenu", label: "With submenu", icon: <CaretRight className={segmentedIconClassName} weight="bold" /> },
                  ]}
                />
                <SegmentedControl
                  indicatorId="trigger"
                  defaultValue="icon"
                  options={[
                    { value: "icon", label: "Icon trigger", icon: <DotsThree className={segmentedIconClassName} weight="bold" /> },
                    { value: "text", label: "Text trigger", icon: <TextAa className={segmentedIconClassName} weight="bold" /> },
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
                    <ComponentsGlyphIcon className="size-4" tone="muted" />
                    Compact
                  </Button>
                  <Button variant="secondary" size="sm" className="gap-2">
                    <ComponentsGlyphIcon className="size-4" tone="muted" />
                    Small
                  </Button>
                  <Button variant="secondary" className="gap-2">
                    <ComponentsGlyphIcon className="size-4" tone="muted" />
                    Default
                  </Button>
                  <Button variant="secondary" size="lg" className="gap-2">
                    <ComponentsGlyphIcon className="size-4" tone="muted" />
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
                    <CourseArrowIcon className="h-3 w-3" />
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
              <SwitchExample />
            </ComponentCard>
            <ComponentCard
              title="Color selector"
              mono="spell.sh"
              className="sm:col-span-2"
              previewClassName="min-h-0 p-4 md:p-6"
            >
              <ColorSelectorExample />
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
            <ComponentCard title="Filter bar">
              <FilterBar
                aria-label="Content type filters"
                defaultValue="all"
                items={[
                  { value: "all", label: "All" },
                  { value: "news", label: "News" },
                  { value: "wallet", label: "Wallet" },
                ]}
              />
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
                    icon: <PaymentsIcon size={16} />,
                  },
                  {
                    value: "balances",
                    label: "Balances",
                    icon: <BalancesIcon size={16} />,
                  },
                  {
                    value: "customers",
                    label: "Customers",
                    hiddenOnMobile: true,
                    icon: <CustomersIcon size={16} />,
                  },
                  {
                    value: "billing",
                    label: "Billing",
                    icon: <BillingIcon size={16} />,
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
            shadcn/ui + Bloom Menu + Central Control
          </p>
          <p className="text-[11px] text-muted-foreground font-mono">2026</p>
        </div>
      </footer>
    </div>
>>>>>>> aca35ad (feat: add central control)
  );
}
