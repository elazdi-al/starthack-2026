"use client";

import { motion } from "motion/react";
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  WidgetShell,
  WidgetAccentPicker,
  WidgetCopyAction,
  WIDGET_ACCENTS,
  WIDGET_ANIMATED_STYLE,
  WIDGET_CONTENT_TRANSITION,
  WIDGET_EXIT_TRANSITION,
  WIDGET_SLOT_ENTER_DELAY,
  getWidgetCapsuleStyle,
  getWidgetIconButtonStyle,
  useWidgetInteraction,
  widgetFieldClassName,
  widgetPrimaryTextClassName,
  widgetSecondaryTextClassName,
} from "@/components/ui/widget-shell";

interface WalletWidgetState {
  address: string;
  balance: number;
  color: string;
  name: string;
}

type IconProps = ComponentPropsWithoutRef<"svg"> & {
  color?: string;
  size?: number;
};

function Bell2Icon({ color = "currentColor", size = 24, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      {...props}
    >
      <title>Bell 2</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M12 2C8.10602 2 4.89608 5.05346 4.70162 8.94258L4.52221 12.5309C4.5153 12.6691 4.47977 12.8044 4.41788 12.9282L3.19098 15.382C3.06539 15.6332 3 15.9101 3 16.191C3 17.1901 3.80992 18 4.80902 18H7.10002C7.56329 20.2822 9.58104 22 12 22C14.419 22 16.4367 20.2822 16.9 18H19.191C20.1901 18 21 17.1901 21 16.191C21 15.9101 20.9346 15.6332 20.809 15.382L19.5821 12.9282C19.5202 12.8044 19.4847 12.6691 19.4778 12.5309L19.2984 8.94258C19.1039 5.05346 15.894 2 12 2ZM12 20C10.6938 20 9.58254 19.1652 9.17071 18H14.8293C14.4175 19.1652 13.3062 20 12 20Z"
        fill={color}
      />
    </svg>
  );
}

function DotGrid1X3HorizontalIcon({
  color = "currentColor",
  size = 24,
  ...props
}: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      width={size}
      height={size}
      {...props}
    >
      <title>Dot Grid 1 X 3 Horizontal</title>
      <path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M2 12C2 10.8954 2.89543 10 4 10C5.10457 10 6 10.8954 6 12C6 13.1046 5.10457 14 4 14C2.89543 14 2 13.1046 2 12ZM10 12C10 10.8954 10.8954 10 12 10C13.1046 10 14 10.8954 14 12C14 13.1046 13.1046 14 12 14C10.8954 14 10 13.1046 10 12ZM18 12C18 10.8954 18.8954 10 20 10C21.1046 10 22 10.8954 22 12C22 13.1046 21.1046 14 20 14C18.8954 14 18 13.1046 18 12Z"
        fill={color}
      />
    </svg>
  );
}

export function WalletWidgetExample({
  className,
  ...props
}: ComponentPropsWithoutRef<"div">) {
  const inputRef = useRef<HTMLInputElement>(null);

  const [wallet, setWallet] = useState<WalletWidgetState>({
    address: "0x1234567890abcdef1234567890abcdef12345678",
    balance: 57_206,
    color: WIDGET_ACCENTS[10],
    name: "Raphael",
  });

  const {
    actionLabel,
    clearStep,
    handleActionClick,
    handleOpenChange,
    isEditingTitle,
    isOpen,
    isPickingAccent,
  } = useWidgetInteraction({ editLabel: "Edit Name" });

  function commitName() {
    setWallet((currentWallet) => ({
      ...currentWallet,
      name: currentWallet.name.trim() || "New Wallet",
    }));
  }

  function finishNameEdit() {
    commitName();
    clearStep();
    triggerHaptic("success");
  }

  function handleCustomizeClick() {
    handleActionClick(commitName);
    triggerHaptic(isEditingTitle ? "success" : "selection");
  }

  function handleDialogChange(open: boolean) {
    handleOpenChange(open);
    triggerHaptic(open ? "soft" : "selection");
  }

  useEffect(() => {
    if (!isEditingTitle || !inputRef.current) {
      return;
    }

    const element = inputRef.current;
    const length = element.value.length;
    element.focus();
    element.setSelectionRange(length, length);
  }, [isEditingTitle]);

  return (
    <WidgetShell
      className={className}
      accent={wallet.color}
      dialogTitle="Wallet Widget Settings"
      isOpen={isOpen}
      layoutId="wallet-widget-example"
      onOpenChange={handleDialogChange}
      panel={
        isPickingAccent ? (
          <WidgetAccentPicker
            selectedAccent={wallet.color}
            onSelect={(color) => {
              setWallet((currentWallet) => ({ ...currentWallet, color }));
              triggerHaptic("selection");
            }}
            onDone={() => {
              clearStep();
              triggerHaptic("success");
            }}
          />
        ) : null
      }
      compactTopLeft={
        <div className="flex size-[30px] items-center justify-center">
          <Bell2Icon color="rgba(255,255,255,0.95)" />
        </div>
      }
      compactBottomLeft={
        <>
          <input
            className={widgetFieldClassName}
            type="text"
            value={wallet.name}
            disabled
            placeholder="Wallet Name"
            aria-label="Wallet name"
          />
          <p className={widgetSecondaryTextClassName}>${wallet.balance.toLocaleString()}</p>
        </>
      }
      compactTopRight={
        <div
          aria-hidden="true"
          className="pointer-events-none"
          style={{ ...getWidgetIconButtonStyle(), ...WIDGET_ANIMATED_STYLE }}
        >
          <DotGrid1X3HorizontalIcon color="rgba(255,255,255,0.95)" size={24} />
        </div>
      }
      compactBottomRight={
        <div
          className="pointer-events-none"
          style={{ ...getWidgetCapsuleStyle(), opacity: 0 }}
        >
          <p className={cn(widgetPrimaryTextClassName, "text-white/85")}>Customize</p>
        </div>
      }
      expandedTopLeft={
        <div className="flex size-[30px] items-center justify-center">
          <Bell2Icon color="rgba(255,255,255,0.95)" />
        </div>
      }
      expandedBottomLeft={
        <>
          <input
            ref={inputRef}
            className={widgetFieldClassName}
            type="text"
            value={wallet.name}
            disabled={!isEditingTitle}
            placeholder="Wallet Name"
            aria-label="Wallet name"
            onChange={(event) =>
              setWallet((currentWallet) => ({
                ...currentWallet,
                name: event.target.value,
              }))
            }
            onBlur={finishNameEdit}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.currentTarget.blur();
              }
            }}
          />
          <p className={widgetSecondaryTextClassName}>${wallet.balance.toLocaleString()}</p>
        </>
      }
      expandedTopRight={
        <WidgetCopyAction
          value={wallet.address}
          idleLabel="Copy Address"
          delay={isPickingAccent ? 0 : WIDGET_SLOT_ENTER_DELAY}
        />
      }
      expandedBottomRight={
        <motion.div
          aria-label={actionLabel}
          role="button"
          tabIndex={0}
          className="cursor-pointer"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 4, transition: WIDGET_EXIT_TRANSITION }}
          style={{
            ...getWidgetCapsuleStyle(isEditingTitle ? wallet.color : undefined),
            ...WIDGET_ANIMATED_STYLE,
          }}
          transition={{
            ...WIDGET_CONTENT_TRANSITION,
            delay: isPickingAccent ? 0 : WIDGET_SLOT_ENTER_DELAY + 0.03,
          }}
          onClick={handleCustomizeClick}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              handleCustomizeClick();
            }
          }}
        >
          <p
            className={cn(
              widgetPrimaryTextClassName,
              isEditingTitle ? "text-[color:inherit]" : "text-white/80"
            )}
          >
            {actionLabel}
          </p>
        </motion.div>
      }
      {...props}
    />
  );
}
