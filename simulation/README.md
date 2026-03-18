# Mars Greenhouse Simulation

A simple simulation system for a Mars greenhouse with clear separation between sensor readings, machine outputs, and simulation logic.

## Architecture

- **EnvironmentState**: Sensor readings (temperature, humidity, CO2, soil moisture, light, plant growth, external conditions)
- **GreenhouseState**: Machine outputs (water pump, lighting, heating, CO2 injection, ventilation)
- **simulate()**: Pure function that takes current environment + machine outputs → returns next environment state

## Usage

```typescript
import { simulate, createInitialEnvironment, createInitialGreenhouse } from './simulation';

// Initialize
let environment = createInitialEnvironment();
let greenhouse = createInitialGreenhouse();

// Run simulation step (5 minutes)
environment = simulate(environment, greenhouse, 5);

// Adjust machine outputs
greenhouse.waterPumpRate = 20;
greenhouse.heatingPower = 5000;

// Run another step
environment = simulate(environment, greenhouse, 5);
```

## Running the Example

```bash
npx tsx simulation/example.ts
```
