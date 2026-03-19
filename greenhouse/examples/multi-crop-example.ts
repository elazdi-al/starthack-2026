import { createInitialState } from '../implementations/multi-crop/initial';
import { applyTransformations } from '../implementations/multi-crop/transformation';

function runExample() {
  const state = createInitialState();

  console.log('=== Initial State ===');
  const env0 = state.simulation.getEnvironment(0);
  console.log('Air Temperature:', env0.airTemperature.toFixed(1), '°C');
  console.log('Humidity:', env0.humidity.toFixed(1), '%');
  console.log('CO2:', env0.co2Level.toFixed(0), 'ppm');
  console.log('\nTomatoes:');
  console.log('  Soil Moisture:', env0.tomatoes.soilMoisture.toFixed(1), '%');
  console.log('  Soil Temp:', env0.tomatoes.soilTemperature.toFixed(1), '°C');
  console.log('  Growth:', env0.tomatoes.plantGrowth.toFixed(1), '%');
  console.log('\nCarrots:');
  console.log('  Soil Moisture:', env0.carrots.soilMoisture.toFixed(1), '%');
  console.log('  Soil Temp:', env0.carrots.soilTemperature.toFixed(1), '°C');
  console.log('  Growth:', env0.carrots.plantGrowth.toFixed(1), '%');

  // Simulate 60 minutes
  console.log('\n=== After 60 minutes ===');
  const env60 = state.simulation.getEnvironment(60);
  console.log('Air Temperature:', env60.airTemperature.toFixed(1), '°C');
  console.log('Humidity:', env60.humidity.toFixed(1), '%');
  console.log('CO2:', env60.co2Level.toFixed(0), 'ppm');
  console.log('\nTomatoes:');
  console.log('  Soil Moisture:', env60.tomatoes.soilMoisture.toFixed(1), '%');
  console.log('  Soil Temp:', env60.tomatoes.soilTemperature.toFixed(1), '°C');
  console.log('  Growth:', env60.tomatoes.plantGrowth.toFixed(1), '%');
  console.log('  Leaf Area:', env60.tomatoes.leafArea.toFixed(2), 'm²');
  console.log('\nCarrots:');
  console.log('  Soil Moisture:', env60.carrots.soilMoisture.toFixed(1), '%');
  console.log('  Soil Temp:', env60.carrots.soilTemperature.toFixed(1), '°C');
  console.log('  Growth:', env60.carrots.plantGrowth.toFixed(1), '%');
  console.log('  Leaf Area:', env60.carrots.leafArea.toFixed(2), 'm²');

  // Adjust controls using immutable transformations (snapshot at t=60)
  console.log('\n=== Adjusting controls ===');
  const updatedState = applyTransformations(state, 60, [
    { type: 'crop', param: 'waterPumpRate', value: 15, crop: 'tomatoes' },
    { type: 'crop', param: 'waterPumpRate', value: 12, crop: 'carrots' },
    { type: 'greenhouse', param: 'globalHeatingPower', value: 5000 },
  ]);
  console.log('Increased water and heating');

  // Simulate another 60 minutes from the updated snapshot
  console.log('\n=== After 120 minutes total ===');
  const env120 = updatedState.simulation.getEnvironment(60);
  console.log('Air Temperature:', env120.airTemperature.toFixed(1), '°C');
  console.log('\nTomatoes:');
  console.log('  Soil Moisture:', env120.tomatoes.soilMoisture.toFixed(1), '%');
  console.log('  Growth:', env120.tomatoes.plantGrowth.toFixed(1), '%');
  console.log('\nCarrots:');
  console.log('  Soil Moisture:', env120.carrots.soilMoisture.toFixed(1), '%');
  console.log('  Growth:', env120.carrots.plantGrowth.toFixed(1), '%');
}

if (require.main === module) {
  runExample();
}

export { runExample };
