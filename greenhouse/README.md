# Mars Greenhouse System

Type definitions for Mars greenhouse simulation and control.

## Structure

```
greenhouse/
├── state/          # All state type definitions
│   └── types.ts           # Environment, GreenhouseState, SimulationState, State
└── decision/       # Control logic types
    └── index.ts           # DecideFunction type
```

## Types

**Environment**: Sensor readings (temperature, humidity, CO2, soil moisture, light, plant growth, external conditions)

**GreenhouseState**: Machine outputs (water pump, lighting, heating, CO2 injection, ventilation)

**SimulationState**: Simulation state with `getEnvironment(time)` method to query environment at any time t

**State**: Complete system state containing current simulation and greenhouse machine outputs

**DecideFunction**: `(environment, machines) => nextMachines`
