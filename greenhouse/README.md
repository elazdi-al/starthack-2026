# Mars Greenhouse System

Organized structure for Mars greenhouse simulation and control.

## Structure

```
greenhouse/
├── state/          # State definitions
│   ├── types.ts           # EnvironmentState & GreenhouseState types
│   ├── environment.ts     # Initial sensor readings
│   └── greenhouse.ts      # Initial machine outputs
├── simulation/     # Physics simulation
│   └── simulate.ts        # simulate() function: (env, machines) → next env
└── decision/       # Control logic (empty for now)
    └── index.ts           # decide() function: (env, machines) → next machines
```

## Usage

```typescript
import { 
  createInitialEnvironment, 
  createInitialGreenhouse 
} from './state';
import { simulate } from './simulation';
import { decide } from './decision';

// Initialize
let environment = createInitialEnvironment();
let greenhouse = createInitialGreenhouse();

// Simulation loop
for (let step = 0; step < 10; step++) {
  // 1. Simulate: compute next environment from current state + machines
  environment = simulate(environment, greenhouse, 5);
  
  // 2. Decide: compute next machine outputs from environment
  greenhouse = decide(environment, greenhouse);
}
```

## Running the Example

```bash
npx tsx greenhouse/example.ts
```
