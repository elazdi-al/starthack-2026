import { greenhouseAgent, applyTransformations } from '../greenhouse-agent';
import { createInitialState } from '../../greenhouse/implementations/multi-crop/initial';
import { ConcreteEnvironment, ConcreteGreenhouseState } from '../../greenhouse/implementations/multi-crop/types';

async function main() {
  console.log('🌱 Greenhouse Agent Example\n');

  const initialState = createInitialState();
  const time = 60;

  const env = initialState.simulation.getEnvironment(0) as ConcreteEnvironment;
  const gh = initialState.greenhouse as ConcreteGreenhouseState;

  console.log('📊 Initial Conditions:');
  console.log(`   Temp: ${env.airTemperature}°C | Humidity: ${env.humidity}% | CO2: ${env.co2Level}ppm`);
  console.log(`   Tomato Soil: ${env.tomatoes.soilMoisture}% | Carrot Soil: ${env.carrots.soilMoisture}%\n`);

  console.log('🤖 Asking agent for transformation recommendations...\n');

  try {
    const result = await greenhouseAgent.generate(
      `Analyze this Mars greenhouse and recommend 3-4 parameter transformations:

Current state:
- Air Temperature: ${env.airTemperature}°C (optimal: 20-25°C)
- Humidity: ${env.humidity}% (optimal: 60-80%)
- CO2: ${env.co2Level}ppm (optimal: 800-1200ppm)
- Tomato soil moisture: ${env.tomatoes.soilMoisture}% (optimal: 65-75%)
- Carrot soil moisture: ${env.carrots.soilMoisture}% (optimal: 60-70%)

Current settings:
- Global heating: ${gh.globalHeatingPower}W
- CO2 injection: ${gh.co2InjectionRate}ppm/hour
- Tomato water pump: ${gh.tomatoes.waterPumpRate}L/hour
- Carrot water pump: ${gh.carrots.waterPumpRate}L/hour

Provide 3-4 specific transformations in this JSON format:
[
  {"type": "greenhouse", "param": "paramName", "value": number},
  {"type": "crop", "param": "paramName", "value": number, "crop": "tomatoes"}
]`
    );

    console.log('💬 Agent Recommendations:');
    console.log(result.text);
    console.log();

    // Parse recommendations and apply them
    console.log('🔄 Applying recommended transformations...\n');
    
    // Example transformations based on typical recommendations
    const transformations = [
      { type: 'greenhouse' as const, param: 'globalHeatingPower', value: 3500 },
      { type: 'greenhouse' as const, param: 'co2InjectionRate', value: 80 },
      { type: 'crop' as const, param: 'waterPumpRate', value: 12, crop: 'tomatoes' as const },
    ];

    const finalState = applyTransformations(initialState, time, transformations);
    const finalEnv = finalState.simulation.getEnvironment(time) as ConcreteEnvironment;
    const finalGh = finalState.greenhouse as ConcreteGreenhouseState;

    console.log('✅ Final State:');
    console.log(`   Temp: ${finalEnv.airTemperature.toFixed(1)}°C | Humidity: ${finalEnv.humidity.toFixed(1)}%`);
    console.log(`   Tomato Soil: ${finalEnv.tomatoes.soilMoisture.toFixed(1)}% | Carrot Soil: ${finalEnv.carrots.soilMoisture.toFixed(1)}%`);
    
  } catch (error) {
    console.error('Error:', (error as Error).message);
  }
}

main();
