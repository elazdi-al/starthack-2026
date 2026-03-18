# Components

- `ui/` contains the reusable, registry-ready components with stable public names.
- `examples/` contains showcase-only compositions and specimens built from `ui/`.
- `examples/main-page-example.tsx` preserves the original landing page composition as a promptable reference example.
- `layout/` contains app chrome that belongs to this site, not the shared component library.

Naming rule of thumb: prefer behavior-based names like `segmented-control` and `highlight-tabs` over implementation details or app-specific names.
