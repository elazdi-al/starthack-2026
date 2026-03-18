import { SpringConfig, DialStore } from '../store/DialStore';
import { Folder } from './Folder';
import { Slider } from './Slider';
import { SegmentedControl } from './SegmentedControl';
import { SpringVisualization } from './SpringVisualization';
import { useSyncExternalStore } from 'react';

interface SpringControlProps {
  panelId: string;
  path: string;
  label: string;
  spring: SpringConfig;
  onChange: (spring: SpringConfig) => void;
}

export function SpringControl({ panelId, path, label, spring, onChange }: SpringControlProps) {
  const mode = useSyncExternalStore(
    (cb) => DialStore.subscribe(panelId, cb),
    () => DialStore.getSpringMode(panelId, path),
    () => DialStore.getSpringMode(panelId, path)
  );

  const isSimpleMode = mode === 'simple';

  const handleModeChange = (newMode: 'simple' | 'advanced') => {
    DialStore.updateSpringMode(panelId, path, newMode);

    // When switching modes, update the spring config to remove conflicting properties
    if (newMode === 'simple') {
      // Remove physics properties, keep/add time-based properties
      const { stiffness, damping, mass, ...rest } = spring;
      onChange({
        ...rest,
        type: 'spring',
        visualDuration: spring.visualDuration ?? 0.3,
        bounce: spring.bounce ?? 0.2,
      });
    } else {
      // Remove time-based properties, keep/add physics properties
      const { visualDuration, bounce, ...rest } = spring;
      onChange({
        ...rest,
        type: 'spring',
        stiffness: spring.stiffness ?? 200,
        damping: spring.damping ?? 25,
        mass: spring.mass ?? 1,
      });
    }
  };

  const handleUpdate = (key: keyof SpringConfig, value: number) => {
    // When updating in simple mode, ensure physics props are removed
    if (isSimpleMode) {
      const { stiffness, damping, mass, ...rest } = spring;
      onChange({ ...rest, [key]: value });
    } else {
      // When updating in physics mode, ensure time-based props are removed
      const { visualDuration, bounce, ...rest } = spring;
      onChange({ ...rest, [key]: value });
    }
  };

  return (
    <Folder title={label} defaultOpen={true}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <SpringVisualization spring={spring} isSimpleMode={isSimpleMode} />

        <div className="dialkit-labeled-control">
          <span className="dialkit-labeled-control-label">Type</span>
          <SegmentedControl
            options={[
              { value: 'simple' as const, label: 'Time' },
              { value: 'advanced' as const, label: 'Physics' },
            ]}
            value={mode}
            onChange={handleModeChange}
          />
        </div>

        {isSimpleMode ? (
          <>
            <Slider
              label="Duration"
              value={spring.visualDuration ?? 0.3}
              onChange={(v) => handleUpdate('visualDuration', v)}
              min={0.1}
              max={1}
              step={0.05}
              unit="s"
            />
            <Slider
              label="Bounce"
              value={spring.bounce ?? 0.2}
              onChange={(v) => handleUpdate('bounce', v)}
              min={0}
              max={1}
              step={0.05}
            />
          </>
        ) : (
          <>
            <Slider
              label="Stiffness"
              value={spring.stiffness ?? 400}
              onChange={(v) => handleUpdate('stiffness', v)}
              min={1}
              max={1000}
              step={10}
            />
            <Slider
              label="Damping"
              value={spring.damping ?? 17}
              onChange={(v) => handleUpdate('damping', v)}
              min={1}
              max={100}
              step={1}
            />
            <Slider
              label="Mass"
              value={spring.mass ?? 1}
              onChange={(v) => handleUpdate('mass', v)}
              min={0.1}
              max={10}
              step={0.1}
            />
          </>
        )}
      </div>
    </Folder>
  );
}
