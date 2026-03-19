import { useSyncExternalStore, memo, useCallback } from 'react';
import { triggerHaptic } from '@/lib/haptics';
import { DialStore, type ControlMeta, type PanelConfig, type SpringConfig, type TransitionConfig, type DialValue } from '../store/DialStore';
import { Folder } from './Folder';
import { Slider } from './Slider';
import { Toggle } from './Toggle';
import { SpringControl } from './SpringControl';
import { TransitionControl } from './TransitionControl';
import { TextControl } from './TextControl';
import { SelectControl } from './SelectControl';
import { ColorControl } from './ColorControl';

interface PanelProps {
  panel: PanelConfig;
  defaultOpen?: boolean;
  open?: boolean;
  inline?: boolean;
}

/**
 * Renders a single control within a panel.
 * Extracted and memoized so each control only re-renders when its own value changes.
 */
const PanelControl = memo(function PanelControl({
  control,
  panelId,
  value,
}: {
  control: ControlMeta;
  panelId: string;
  value: unknown;
}) {
  const onChange = useCallback(
    (v: unknown) => DialStore.updateValue(panelId, control.path, v as DialValue),
    [panelId, control.path]
  );

  switch (control.type) {
    case 'slider':
      return (
        <Slider
          label={control.label}
          value={value as number}
          onChange={onChange as (v: number) => void}
          min={control.min}
          max={control.max}
          step={control.step}
        />
      );

    case 'toggle':
      return (
        <Toggle
          label={control.label}
          checked={value as boolean}
          onChange={onChange as (v: boolean) => void}
        />
      );

    case 'spring':
      return (
        <SpringControl
          panelId={panelId}
          path={control.path}
          label={control.label}
          spring={value as SpringConfig}
          onChange={onChange as (v: SpringConfig) => void}
        />
      );

    case 'transition':
      return (
        <TransitionControl
          panelId={panelId}
          path={control.path}
          label={control.label}
          value={value as TransitionConfig}
          onChange={onChange as (v: TransitionConfig) => void}
        />
      );

    case 'folder':
      return (
        <FolderControl
          control={control}
          panelId={panelId}
        />
      );

    case 'text':
      return (
        <TextControl
          label={control.label}
          value={value as string}
          onChange={onChange as (v: string) => void}
          placeholder={control.placeholder}
        />
      );

    case 'select':
      return (
        <SelectControl
          label={control.label}
          value={value as string}
          options={control.options ?? []}
          onChange={onChange as (v: string) => void}
        />
      );

    case 'color':
      return (
        <ColorControl
          label={control.label}
          value={value as string}
          onChange={onChange as (v: string) => void}
        />
      );

    case 'action':
      return (
        <button
          type="button"
          className="dialkit-button"
          onClick={() => {
            DialStore.triggerAction(panelId, control.path);
            triggerHaptic('light');
          }}
        >
          {control.label}
        </button>
      );

    default:
      return null;
  }
});

/**
 * Folder control subscribes to its own panel values so it can pass
 * the correct value to each child control independently.
 */
const FolderControl = memo(function FolderControl({
  control,
  panelId,
}: {
  control: ControlMeta;
  panelId: string;
}) {
  const values = useSyncExternalStore(
    (cb) => DialStore.subscribe(panelId, cb),
    () => DialStore.getValues(panelId),
    () => DialStore.getValues(panelId)
  );

  return (
    <Folder title={control.label} defaultOpen={control.defaultOpen ?? true}>
      {control.children?.map((child) => (
        <PanelControl
          key={child.path}
          control={child}
          panelId={panelId}
          value={values[child.path]}
        />
      ))}
    </Folder>
  );
});

export function Panel({ panel, defaultOpen = true, open, inline = false }: PanelProps) {
  // Subscribe to panel value changes
  const values = useSyncExternalStore(
    (cb) => DialStore.subscribe(panel.id, cb),
    () => DialStore.getValues(panel.id),
    () => DialStore.getValues(panel.id)
  );

  return (
    <div className="dialkit-panel-wrapper">
      <Folder title={panel.name} defaultOpen={defaultOpen} open={open} isRoot={true} inline={inline}>
        {panel.controls.map((control) => (
          <PanelControl
            key={control.path}
            control={control}
            panelId={panel.id}
            value={values[control.path]}
          />
        ))}
      </Folder>
    </div>
  );
}
