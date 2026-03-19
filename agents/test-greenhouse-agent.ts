import { greenhouseAgent } from './greenhouse-agent';
import { applyTransformations } from '../greenhouse/implementations/multi-crop/transformation';
import { createInitialState } from '../greenhouse/implementations/multi-crop/initial';

async function testGreenhouseAgent() {
  console.log('Testing Greenhouse Transformation Agent\n');

  const initialState = createInitialState();
  const time = 60;

  const initialEnv = initialState.simulation.getEnvironment(0);

  console.log('Initial State:');
  console.log('- Air Temperature:', initialEnv.airTemperature);
  console.log('- Global Heating:', initialState.greenhouse.globalHeatingPower);
  console.log('- Tomato Water Pump:', initialState.greenhouse.crops.tomato.waterPumpRate);
  console.log('- Lettuce Water Pump:', initialState.greenhouse.crops.lettuce.waterPumpRate);
  console.log();

  const transformations = [
    { type: 'greenhouse' as const, param: 'globalHeatingPower', value: 4000 },
    { type: 'greenhouse' as const, param: 'co2InjectionRate', value: 80 },
    { type: 'crop' as const, param: 'waterPumpRate', value: 15, crop: 'tomato' as const },
    { type: 'crop' as const, param: 'waterPumpRate', value: 10, crop: 'lettuce' as const },
  ];

  console.log('Applying transformations:');
  transformations.forEach((t, i) => {
    if (t.type === 'greenhouse') {
      console.log(`${i + 1}. Update ${t.param} to ${t.value}`);
    } else {
      console.log(`${i + 1}. Update ${t.crop} ${t.param} to ${t.value}`);
    }
  });
  console.log();

  const finalState = applyTransformations(initialState, time, transformations);
  const finalEnv = finalState.simulation.getEnvironment(time);

  console.log('Final State:');
  console.log('- Air Temperature:', finalEnv.airTemperature);
  console.log('- Global Heating:', finalState.greenhouse.globalHeatingPower);
  console.log('- Tomato Water Pump:', finalState.greenhouse.crops.tomato.waterPumpRate);
  console.log('- Lettuce Water Pump:', finalState.greenhouse.crops.lettuce.waterPumpRate);
  console.log();

  console.log('Testing agent text generation...');
  try {
    const result = await greenhouseAgent.generate('Explain how greenhouse parameter transformations work');
    console.log('Agent response:', result.text);
  } catch (error) {
    console.log('Agent test skipped (requires AWS credentials):', (error as Error).message);
  }
}

testGreenhouseAgent();
