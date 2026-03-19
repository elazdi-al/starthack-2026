import { greenhouseAgent, applyTransformations } from './greenhouse-agent';
import { createInitialState } from '../greenhouse/implementations/multi-crop/initial';
import { ConcreteState, ConcreteEnvironment, ConcreteGreenhouseState } from '../greenhouse/implementations/multi-crop/types';

async function testGreenhouseAgent() {
  console.log('🌱 Testing Greenhouse Transformation Agent\n');

  // Create initial state
  const initialState = createInitialState();
  const time = 60; // 60 minutes

  const initialEnv = initialState.simulation.getEnvironment(0) as ConcreteEnvironment;
  const initialGreenhouse = initialState.greenhouse as ConcreteGreenhouseState;

  console.log('Initial State:');
  console.log('- Air Temperature:', initialEnv.airTemperature);
  console.log('- Global Heating:', initialGreenhouse.globalHeatingPower);
  console.log('- Tomato Water Pump:', initialGreenhouse.tomatoes.waterPumpRate);
  console.log('- Carrot Water Pump:', initialGreenhouse.carrots.waterPumpRate);
  console.log();

  // Define transformations to apply
  const transformations = [
    { type: 'greenhouse' as const, param: 'globalHeatingPower', value: 4000 },
    { type: 'greenhouse' as const, param: 'co2InjectionRate', value: 80 },
    { type: 'crop' as const, param: 'waterPumpRate', value: 15, crop: 'tomatoes' as const },
    { type: 'crop' as const, param: 'waterPumpRate', value: 12, crop: 'carrots' as const },
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

  // Apply transformations
  const finalState = applyTransformations(initialState, time, transformations);

  const finalEnv = finalState.simulation.getEnvironment(time) as ConcreteEnvironment;
  const finalGreenhouse = finalState.greenhouse as ConcreteGreenhouseState;

  console.log('Final State:');
  console.log('- Air Temperature:', finalEnv.airTemperature);
  console.log('- Global Heating:', finalGreenhouse.globalHeatingPower);
  console.log('- Tomato Water Pump:', finalGreenhouse.tomatoes.waterPumpRate);
  console.log('- Carrot Water Pump:', finalGreenhouse.carrots.waterPumpRate);
  console.log();

  // Test with agent (optional - requires API key)
  console.log('Testing agent text generation...');
  try {
    const result = await greenhouseAgent.generate('Explain how greenhouse parameter transformations work');
    console.log('Agent response:', result.text);
  } catch (error) {
    console.log('Agent test skipped (requires OPENAI_API_KEY):', (error as Error).message);
  }
}

testGreenhouseAgent();
