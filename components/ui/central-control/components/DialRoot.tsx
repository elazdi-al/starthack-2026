import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DialStore, PanelConfig } from '../store/DialStore';
import { Panel } from './Panel';

export type DialPosition = 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
export type DialMode = 'popover' | 'inline';

interface DialRootProps {
  position?: DialPosition;
  defaultOpen?: boolean;
  open?: boolean;
  mode?: DialMode;
}

export function DialRoot({ position = 'top-right', defaultOpen = true, open, mode = 'popover' }: DialRootProps) {
  const [panels, setPanels] = useState<PanelConfig[]>([]);
  const [mounted, setMounted] = useState(false);
  const [dragPos, setDragPos] = useState<{ x: number; y: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const dragState = useRef<{ startX: number; startY: number; initLeft: number; initTop: number } | null>(null);
  const inline = mode === 'inline';

  // Subscribe to global panel changes
  useEffect(() => {
    setMounted(true);
    setPanels(DialStore.getPanels());

    const unsubscribe = DialStore.subscribeGlobal(() => {
      setPanels(DialStore.getPanels());
    });

    return unsubscribe;
  }, []);

  // Drag listeners (event delegation for .dialkit-drag-handle)
  useEffect(() => {
    if (inline || !mounted) return;
    const panel = panelRef.current;
    if (!panel) return;

    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dialkit-drag-handle')) return;
      const rect = panel.getBoundingClientRect();
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        initLeft: rect.left,
        initTop: rect.top,
      };
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!dragState.current) return;
      const { startX, startY, initLeft, initTop } = dragState.current;
      setDragPos({
        x: initLeft + (e.clientX - startX),
        y: initTop + (e.clientY - startY),
      });
    };

    const onMouseUp = () => {
      dragState.current = null;
    };

    panel.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      panel.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [inline, mounted]);

  // Don't render on server
  if (!mounted || typeof window === 'undefined') {
    return null;
  }

  // Don't render if no panels registered
  if (panels.length === 0) {
    return null;
  }

  const content = (
    <div className="dialkit-root" data-mode={mode}>
      <div
        ref={panelRef}
        className="dialkit-panel"
        data-position={inline || dragPos ? undefined : position}
        data-mode={mode}
        style={dragPos ? { top: dragPos.y, left: dragPos.x } : undefined}
      >
        {panels.map((panel) => (
          <Panel key={panel.id} panel={panel} defaultOpen={inline || defaultOpen} open={inline ? undefined : open} inline={inline} />
        ))}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return createPortal(content, document.body);
}
