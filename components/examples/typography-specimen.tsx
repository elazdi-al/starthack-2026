export function TypographySpecimen() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h3 className="type-display text-foreground">Display Title</h3>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          Inter Variable 500 / 30px base, 36px at xl
        </p>
      </div>

      <div>
        <h3 className="type-title text-foreground">Section Title</h3>
        <p className="type-section-description mt-2 max-w-2xl text-[var(--dial-text-secondary)]">
          Supporting copy sits a little larger and a little firmer now, so
          headings and subtitles feel closer to the same product rhythm as the
          rest of the interface.
        </p>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          24px title + 18px subtitle / medium
        </p>
      </div>

      <div>
        <p className="type-body max-w-2xl text-[var(--dial-text-secondary)]">
          Body copy now uses the same variable sans stack across panels,
          controls, and documentation so the system feels consistent from
          section intros down to compact component labels.
        </p>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          Inter Variable 400 / 16px
        </p>
      </div>

      <div>
        <p className="font-mono text-xs text-foreground/50">
          const tokens = typography.resolve();
        </p>
        <p className="mt-1 text-xs font-mono text-muted-foreground">
          Mono readout / 12px
        </p>
      </div>
    </div>
  );
}
