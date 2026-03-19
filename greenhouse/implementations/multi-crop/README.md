# Multi-Crop Greenhouse Implementation

Concrete implementation of the Mars greenhouse system supporting multiple crops (tomatoes and carrots).

## Structure

Each crop has its own:
- **Environment readings**: soil moisture, soil temperature, plant growth, leaf area, fruit count
- **Controls**: water pump rate, local heating power

Plus global greenhouse readings and controls.

## Usage

```typescript
import { createInitialState, simulate } from './implementations/multi-crop';

// Create initial state
const state = createInitialState();

// Access greenhouse controls
console.log(state.greenhouse.tomatoes.waterPumpRate);
console.log(state.greenhouse.carrots.localHeatingPower);

// Query environment at time t (returns typed ConcreteEnvironment)
const env = state.simulation.getEnvironment(10);
console.log(env.tomatoes.plantGrowth);
console.log(env.carrots.soilMoisture);

// Or call the pure simulation function directly (e.g. from frontend)
const env2 = simulate(env, state.greenhouse, 60);
```

## Crops

- **Tomatoes**: Require higher soil temperature (22°C), more water
- **Carrots**: Prefer cooler soil (18°C), less water
