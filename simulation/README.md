# Mars Greenhouse Simulation

A simulation system for a Mars greenhouse that models environmental conditions and greenhouse control systems.

## Structure

- **EnvironmentState**: External Mars conditions read by sensors (temperature, solar radiation, dust storms, etc.)
- **GreenhouseState**: Internal controlled systems (water, lighting, heating, CO2, plant growth)
- **MarsEnvironment**: Simulates changing Mars conditions over time
- **Greenhouse**: Manages internal systems and plant growth
- **MarsGreenhouseSimulator**: Main orchestrator that ties everything together

## Usage

```typescript
import { MarsGreenhouseSimulator } from './simulation';

// Create simulator
const simulator = new MarsGreenhouseSimulator({
  updateIntervalMinutes: 5,
});

// Get current state
const state = simulator.getFullState();

// Manual update
simulator.step();

// Control greenhouse
simulator.setWaterSupply(2000);
simulator.setLightingIntensity(90);
simulator.setHeatingPower(6000);
simulator.setCO2Level(1500);

// Auto-update every X minutes
simulator.start((state) => {
  console.log('Updated:', state);
});

// Stop auto-updates
simulator.stop();
```

## Running the Example

```bash
npx tsx simulation/example.ts
```
