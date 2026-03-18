import { triggerHaptic } from '@/lib/haptics';

interface ButtonGroupProps {
  buttons: Array<{
    label: string;
    onClick: () => void;
  }>;
}

export function ButtonGroup({ buttons }: ButtonGroupProps) {
  return (
    <div className="dialkit-button-group">
      {buttons.map((button, index) => (
        <button
          key={index}
          className="dialkit-button"
          onClick={() => { button.onClick(); triggerHaptic('light'); }}
        >
          {button.label}
        </button>
      ))}
    </div>
  );
}
