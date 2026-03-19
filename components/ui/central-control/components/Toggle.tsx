import { memo } from 'react';
import { Switch } from '@/components/ui/switch';

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

export const Toggle = memo(function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <div className="dialkit-labeled-control">
      <span className="dialkit-labeled-control-label">{label}</span>
      <Switch
        checked={checked}
        onToggle={onChange}
        className="!p-0 !gap-0"
      />
    </div>
  );
});
