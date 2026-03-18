import type { ComponentType } from "react";

import {
  ArrowCircleRightIcon,
  ArrowCircleUpIcon,
  ArrowSquareOutIcon,
  ArrowSquareUpRightIcon,
  BellRingingIcon,
  BellSimpleIcon,
  BellSimpleSlashIcon,
  ChartDonutIcon,
  CheckIcon,
  CopyIcon,
  DotsThreeOutlineIcon,
  EyeIcon,
  EyeSlashIcon,
  type IconWeight,
  MoonStarsIcon,
  type IconProps as PhosphorIconProps,
  PulseIcon,
  ReceiptIcon,
  SquaresFourIcon,
  SunDimIcon,
  TrashSimpleIcon,
  UsersThreeIcon,
  WalletIcon,
  XCircleIcon
} from "@phosphor-icons/react";

import { cn } from "@/lib/utils";

type IconTone =
  | "muted"
  | "subtle"
  | "strong"
  | "accent"
  | "accent-cyan"
  | "accent-green"
  | "accent-orange"
  | "accent-purple"
  | "accent-red"
  | "on-accent";

export type IconProps = PhosphorIconProps & {
  tone?: IconTone;
};

type PhosphorIconComponent = ComponentType<PhosphorIconProps>;

const toneClassNames: Record<IconTone, string> = {
  muted: "ui-icon-muted",
  subtle: "ui-icon-subtle",
  strong: "ui-icon-strong",
  accent: "ui-icon-accent",
  "accent-cyan": "ui-icon-accent-cyan",
  "accent-green": "ui-icon-accent-green",
  "accent-orange": "ui-icon-accent-orange",
  "accent-purple": "ui-icon-accent-purple",
  "accent-red": "ui-icon-accent-red",
  "on-accent": "ui-icon-on-accent",
};

function createIcon(
  Icon: PhosphorIconComponent,
  defaults: {
    className?: string;
    mirrored?: boolean;
    size?: number;
    weight?: IconWeight;
  } = {}
) {
  return function AppIcon({
    className,
    mirrored = defaults.mirrored,
    size = defaults.size,
    tone,
    weight = defaults.weight,
    ...props
  }: IconProps) {
    return (
      <Icon
        mirrored={mirrored}
        size={size}
        weight={weight}
        className={cn(
          "ui-icon ui-icon-ios",
          tone ? toneClassNames[tone] : undefined,
          defaults.className,
          className
        )}
        {...props}
      />
    );
  };
}

export const ComponentsGlyphIcon = createIcon(SquaresFourIcon, {
  size: 16,
  weight: "fill",
});

export const CourseArrowIcon = createIcon(ArrowSquareUpRightIcon, {
  size: 12,
  weight: "fill",
});

export const ThemeSunIcon = createIcon(SunDimIcon, {
  size: 16,
  weight: "fill",
});

export const ThemeMoonIcon = createIcon(MoonStarsIcon, {
  size: 16,
  weight: "fill",
});

export const TrashCanIcon = createIcon(TrashSimpleIcon, {
  size: 16,
  weight: "fill",
});

export const WidgetBellIcon = createIcon(BellRingingIcon, {
  size: 24,
  weight: "fill",
});

export const DotGridHorizontalIcon = createIcon(DotsThreeOutlineIcon, {
  size: 24,
  weight: "fill",
});

export const RoutePulseIcon = createIcon(PulseIcon, {
  size: 24,
  weight: "fill",
});

export const NotificationBellIcon = createIcon(BellSimpleIcon, {
  size: 24,
  weight: "fill",
});

export const NotificationBellMutedIcon = createIcon(BellSimpleSlashIcon, {
  size: 24,
  weight: "fill",
});

export const ArrowUpCircleIcon = createIcon(ArrowCircleUpIcon, {
  size: 24,
  weight: "fill",
});

export const ArrowRightCircleIcon = createIcon(ArrowCircleRightIcon, {
  size: 24,
  weight: "fill",
});

export const DeleteActionIcon = createIcon(TrashSimpleIcon, {
  size: 24,
  weight: "fill",
});

export const DeleteActionActiveIcon = createIcon(XCircleIcon, {
  size: 24,
  weight: "fill",
});

export const PaymentsIcon = createIcon(WalletIcon, {
  size: 16,
  weight: "fill",
});

export const BalancesIcon = createIcon(ChartDonutIcon, {
  size: 16,
  weight: "fill",
});

export const CustomersIcon = createIcon(UsersThreeIcon, {
  size: 16,
  weight: "fill",
});

export const BillingIcon = createIcon(ReceiptIcon, {
  size: 16,
  weight: "fill",
});

export const ClipboardIcon = createIcon(CopyIcon, {
  size: 16,
  weight: "fill",
});

export const Checkmark1SmallIcon = createIcon(CheckIcon, {
  size: 16,
  weight: "bold",
});

export const EyeOpenIcon = createIcon(EyeIcon, {
  size: 16,
  weight: "regular",
});

export const EyeClosedIcon = createIcon(EyeSlashIcon, {
  size: 16,
  weight: "regular",
});
