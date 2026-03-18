"use client";

import { DotGridHorizontalIcon, WidgetBellIcon } from "@/components/icons";
import { ColorSelector, WIDGET_ACCENTS } from "@/components/ui/color-selector";
import { motion } from "motion/react";
import { useEffect, useRef, useState, type ComponentPropsWithoutRef } from "react";

import { triggerHaptic } from "@/lib/haptics";
import { cn } from "@/lib/utils";
import {
  WidgetShell,
  WidgetCopyAction,
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
          <ColorSelector
            value={wallet.color}
            onColorSelect={(color) => {
              setWallet((currentWallet) => ({ ...currentWallet, color }));
            }}
            onDone={clearStep}
          />
        ) : null
      }
      compactTopLeft={
        <div className="flex size-[30px] items-center justify-center">
          <WidgetBellIcon color="rgba(255,255,255,0.95)" />
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
          <DotGridHorizontalIcon color="rgba(255,255,255,0.95)" />
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
          <WidgetBellIcon color="rgba(255,255,255,0.95)" />
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
