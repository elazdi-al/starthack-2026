import { createInitialState } from '../implementations/multi-crop/initial';
import { applyTransformations } from '../implementations/multi-crop/transformation';
import { ALL_CROP_TYPES } from '../implementations/multi-crop/types';

function runExample() {
  const state = createInitialState();

  console.log('=== Initial State ===');
  const env0 = state.simulation.getEnvironment(0);
  console.log('Air Temperature:', env0.airTemperature.toFixed(1), '°C');
  console.log('Humidity:', env0.humidity.toFixed(1), '%');
  console.log('CO2:', env0.co2Level.toFixed(0), 'ppm');
  for (const ct of ALL_CROP_TYPES) {
    const crop = env0.crops[ct];
    console.log(`\n${ct}:`);
    console.log('  Soil Moisture:', crop.soilMoisture.toFixed(1), '%');
    console.log('  Soil Temp:', crop.soilTemperature.toFixed(1), '°C');
    console.log('  Growth:', crop.plantGrowth.toFixed(1), '%');
  }

  // Simulate 60 minutes
  console.log('\n=== After 60 minutes ===');
  const env60 = state.simulation.getEnvironment(60);
  console.log('Air Temperature:', env60.airTemperature.toFixed(1), '°C');
  for (const ct of ALL_CROP_TYPES) {
    const crop = env60.crops[ct];
    console.log(`\n${ct}:`);
    console.log('  Soil Moisture:', crop.soilMoisture.toFixed(1), '%');
    console.log('  Growth:', crop.plantGrowth.toFixed(1), '%');
    console.log('  Leaf Area:', crop.leafArea.toFixed(2), 'm²');
  }

  // Adjust controls using immutable transformations (snapshot at t=60)
  console.log('\n=== Adjusting controls ===');
  const updatedState = applyTransformations(state, 60, [
    { type: 'crop', param: 'waterPumpRate', value: 15, crop: 'tomato' },
    { type: 'crop', param: 'waterPumpRate', value: 12, crop: 'potato' },
    { type: 'greenhouse', param: 'globalHeatingPower', value: 5000 },
  ]);
  console.log('Increased tomato/potato water and global heating');

  // Simulate another 60 minutes from the updated snapshot
  console.log('\n=== After 120 minutes total ===');
  const env120 = updatedState.simulation.getEnvironment(60);
  console.log('Air Temperature:', env120.airTemperature.toFixed(1), '°C');
  console.log('\ntomato: Soil Moisture:', env120.crops.tomato.soilMoisture.toFixed(1), '%');
  console.log('potato: Soil Moisture:', env120.crops.potato.soilMoisture.toFixed(1), '%');
}

if (require.main === module) {
  runExample();
}

export { runExample };
