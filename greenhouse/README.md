# Mars Greenhouse System

Type definitions for Mars greenhouse simulation and control.

## Structure

```
greenhouse/
├── state/          # State type definitions
│   └── types.ts           # EnvironmentState & GreenhouseState abstract classes
├── simulation/     # Physics simulation types
│   └── simulate.ts        # SimulateFunction type
└── decision/       # Control logic types
    └── index.ts           # DecideFunction type
```

## Types

**EnvironmentState**: Abstract class for sensor readings (temperature, humidity, CO2, soil moisture, light, plant growth, external conditions)

**GreenhouseState**: Abstract class for machine outputs (water pump, lighting, heating, CO2 injection, ventilation)

**SimulateFunction**: `(env, machines, deltaMinutes) => (time: 0-1) => nextEnv`

**DecideFunction**: `(env, machines) => nextMachines`

## Usage

Implement concrete classes extending the abstract types, then implement the simulation and decision functions.
