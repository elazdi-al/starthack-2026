import { simulate } from './simulator';
import { createInitialEnvironment } from './environment';
import { createInitialGreenhouse } from './greenhouse';
import { EnvironmentState, GreenhouseState } from './types';

// Example usage of the Mars greenhouse simulation
function runExample() {
  // Initialize states
  let environment = createInitialEnvironment();
  let greenhouse = createInitialGreenhouse();

  console.log('=== Initial State ===');
  console.log('Environment (sensors):', environment);
  console.log('Greenhouse (machines):', greenhouse);

  // Run simulation for 3 steps (5 minutes each)
  console.log('\n=== Running 3 simulation steps (5 min each) ===');
  for (let i = 1; i <= 3; i++) {
    environment = simulate(environment, greenhouse, 5);
    console.log(`\nStep ${i}:`);
    console.log(`  Temp: ${environment.temperature.toFixed(1)}°C`);
    console.log(`  Humidity: ${environment.humidity.toFixed(1)}%`);
    console.log(`  Soil Moisture: ${environment.soilMoisture.toFixed(1)}%`);
    console.log(`  CO2: ${environment.co2Level.toFixed(0)} ppm`);
    console.log(`  Plant Growth: ${environment.plantGrowth.toFixed(1)}%`);
  }

  // Adjust machine outputs
  console.log('\n=== Adjusting greenhouse controls ===');
  greenhouse.waterPumpRate = 20;
  greenhouse.heatingPower = 5000;
  greenhouse.co2InjectionRate = 100;
  console.log('New greenhouse settings:', greenhouse);

  // Run more steps with new settings
  console.log('\n=== Running 2 more steps with new settings ===');
  for (let i = 1; i <= 2; i++) {
    environment = simulate(environment, greenhouse, 5);
    console.log(`\nStep ${i}:`);
    console.log(`  Temp: ${environment.temperature.toFixed(1)}°C`);
    console.log(`  Humidity: ${environment.humidity.toFixed(1)}%`);
    console.log(`  Soil Moisture: ${environment.soilMoisture.toFixed(1)}%`);
    console.log(`  CO2: ${environment.co2Level.toFixed(0)} ppm`);
    console.log(`  Plant Growth: ${environment.plantGrowth.toFixed(1)}%`);
  }
}

// Run if executed directly
if (require.main === module) {
  runExample();
}

export { runExample };
