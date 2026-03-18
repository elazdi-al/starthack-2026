import { useState, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Faders } from '@phosphor-icons/react';
import { triggerHaptic } from '@/lib/haptics';

interface FolderProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  isRoot?: boolean;
  inline?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  toolbar?: ReactNode;
}

export function Folder({ title, children, defaultOpen = true, isRoot = false, inline = false, onOpenChange, toolbar }: FolderProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const handleToggle = () => {
    if (inline && isRoot) return;
    const next = !isOpen;
    setIsOpen(next);
    triggerHaptic(next ? 'selection' : 'soft');
    onOpenChange?.(next);
  };

  const folderContent = (
    <div className={`dialkit-folder ${isRoot ? 'dialkit-folder-root' : ''}`}>
      <div className={`dialkit-folder-header ${isRoot ? 'dialkit-panel-header' : ''}`} onClick={!isRoot ? handleToggle : undefined}>
        {isRoot && !inline ? (
          <div className="dialkit-panel-header-row">
            {toolbar && isOpen && (
              <div className="dialkit-panel-toolbar" onClick={(event) => event.stopPropagation()}>
                {toolbar}
              </div>
            )}

            <button
              type="button"
              className="dialkit-panel-toggle"
              style={{ marginLeft: 'auto' }}
              aria-label={`${isOpen ? 'Collapse' : 'Open'} ${title}`}
              title={`${isOpen ? 'Collapse' : 'Open'} ${title}`}
              onClick={(event) => {
                event.stopPropagation();
                handleToggle();
              }}
            >
              <Faders
                className="dialkit-panel-icon"
                size={16}
                weight="fill"
              />
            </button>
          </div>
        ) : (!isRoot || !inline) && (
          <div className="dialkit-folder-header-top">
            {!isRoot && (
              <div className="dialkit-folder-title-row">
                <span className="dialkit-folder-title">
                  {title}
                </span>
              </div>
            )}
            {!isRoot && (
              <motion.svg
                className="dialkit-folder-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                initial={false}
                animate={{ rotate: isOpen ? 0 : 180 }}
                transition={{ type: 'spring', visualDuration: 0.35, bounce: 0.15 }}
              >
                <path d="M6 9.5L12 15.5L18 9.5" />
              </motion.svg>
            )}
          </div>
        )}

        {isRoot && inline && toolbar && isOpen && (
          <div className="dialkit-panel-toolbar" onClick={(e) => e.stopPropagation()}>
            {toolbar}
          </div>
        )}
      </div>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="dialkit-folder-content"
            initial={isRoot ? undefined : { height: 0, opacity: 0 }}
            animate={isRoot ? undefined : { height: 'auto', opacity: 1 }}
            exit={isRoot ? undefined : { height: 0, opacity: 0 }}
            transition={isRoot ? undefined : { type: 'spring', visualDuration: 0.35, bounce: 0.1 }}
            style={isRoot ? undefined : { clipPath: 'inset(0 -20px)' }}
          >
            <div className="dialkit-folder-inner">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  if (isRoot) {
    if (inline) {
      return (
        <div className="dialkit-panel-inner dialkit-panel-inline">
          {folderContent}
        </div>
      );
    }

    return (
      <>
        <motion.button
          type="button"
          className="dialkit-panel-toggle"
          aria-label={`${isOpen ? 'Collapse' : 'Open'} ${title}`}
          title={`${isOpen ? 'Collapse' : 'Open'} ${title}`}
          onClick={handleToggle}
          whileTap={{ scale: 0.92 }}
          transition={{ type: 'spring', visualDuration: 0.15, bounce: 0.3 }}
        >
          <Faders className="dialkit-panel-icon" size={16} weight="fill" />
        </motion.button>

        <AnimatePresence initial={false}>
          {isOpen && (
            <motion.div
              className="dialkit-panel-inner"
              style={{ transformOrigin: 'top right', width: 280, marginTop: 8 }}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ type: 'spring', visualDuration: 0.25, bounce: 0.1 }}
            >
              {toolbar && (
                <div className="dialkit-panel-header">
                  <div className="dialkit-panel-toolbar">
                    {toolbar}
                  </div>
                </div>
              )}
              <div className="dialkit-folder dialkit-folder-root">
                <div className="dialkit-folder-inner">{children}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </>
    );
  }

  return folderContent;
}
