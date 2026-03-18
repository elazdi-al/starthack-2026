import { MarsGreenhouseSimulator } from './simulator';

// Example usage of the Mars greenhouse simulation
function runExample() {
  // Create simulator with custom config
  const simulator = new MarsGreenhouseSimulator({
    updateIntervalMinutes: 5,
    initialEnvironment: {
      externalTemperature: -60,
      dustStormIntensity: 0,
    },
    initialGreenhouse: {
      waterSupply: 1500,
      lightingIntensity: 85,
    },
  });

  // Log state on each update
  const logState = (state: ReturnType<typeof simulator.getFullState>) => {
    console.log('\n=== Mars Greenhouse Status ===');
    console.log(`Sol ${state.environment.marsTime.sol}, Hour ${state.environment.marsTime.hour.toFixed(1)}`);
    console.log('\nEnvironment:');
    console.log(`  Temperature: ${state.environment.externalTemperature.toFixed(1)}°C`);
    console.log(`  Solar Radiation: ${state.environment.solarRadiation.toFixed(0)} W/m²`);
    console.log(`  Dust Storm: ${(state.environment.dustStormIntensity * 100).toFixed(0)}%`);
    console.log('\nGreenhouse:');
    console.log(`  Water Supply: ${state.greenhouse.waterSupply.toFixed(1)}L`);
    console.log(`  Soil Moisture: ${state.greenhouse.soilMoisture.toFixed(1)}%`);
    console.log(`  Plant Growth: ${state.greenhouse.plantGrowthStage.toFixed(1)}%`);
    console.log(`  CO2 Level: ${state.greenhouse.co2Level.toFixed(0)} ppm`);
  };

  // Get initial state
  console.log('Initial state:');
  logState(simulator.getFullState());

  // Manual step example
  console.log('\n--- Running 3 manual steps ---');
  for (let i = 0; i < 3; i++) {
    simulator.step();
    logState(simulator.getFullState());
  }

  // Adjust greenhouse controls
  console.log('\n--- Adjusting controls ---');
  simulator.setWaterSupply(2000);
  simulator.setLightingIntensity(95);
  simulator.setCO2Level(1500);
  logState(simulator.getFullState());

  // Start automatic updates (uncomment to run continuously)
  // simulator.start(logState);
  
  // To stop: simulator.stop();
}

// Run if executed directly
if (require.main === module) {
  runExample();
}

export { runExample };
