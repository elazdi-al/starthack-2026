import { greenhouseAgent, transformationSchema } from '../greenhouse-agent';
import { applyTransformations } from '../../greenhouse/implementations/multi-crop/transformation';
import { createInitialState } from '../../greenhouse/implementations/multi-crop/initial';
import { ALL_CROP_TYPES } from '../../greenhouse/implementations/multi-crop/types';

async function main() {
  console.log('Greenhouse Agent Example\n');

  const initialState = createInitialState();
  const time = 60;

  const env = initialState.simulation.getEnvironment(0);
  const gh = initialState.greenhouse;

  // Build per-crop status string
  const cropStatus = ALL_CROP_TYPES.map(ct =>
    `- ${ct}: soil moisture ${env.crops[ct].soilMoisture}%, soil temp ${env.crops[ct].soilTemperature}°C`
  ).join('\n');

  const cropSettings = ALL_CROP_TYPES.map(ct =>
    `- ${ct}: water ${gh.crops[ct].waterPumpRate} L/h, heating ${gh.crops[ct].localHeatingPower}W`
  ).join('\n');

  console.log('Initial Conditions:');
  console.log(`   Temp: ${env.airTemperature}°C | Humidity: ${env.humidity}% | CO2: ${env.co2Level}ppm`);
  console.log(`   Heating: ${gh.globalHeatingPower}W | CO2 Injection: ${gh.co2InjectionRate}ppm/h\n`);

  console.log('Agent analyzing conditions...\n');

  const result = await greenhouseAgent.generate(
    `Analyze this Mars greenhouse and determine optimal transformations:

Environment:
- Air Temperature: ${env.airTemperature}°C
- Humidity: ${env.humidity}%
- CO2 Level: ${env.co2Level} ppm

Per-crop sensor data:
${cropStatus}

Current Global Settings:
- Global Heating: ${gh.globalHeatingPower}W
- CO2 Injection: ${gh.co2InjectionRate} ppm/hour
- Ventilation: ${gh.ventilationRate} m³/hour
- Lighting: ${gh.lightingPower}W

Per-crop controls:
${cropSettings}

Time: ${time} minutes

Provide transformations to optimize plant health and growth.`,
    {
      structuredOutput: {
        schema: transformationSchema,
      },
    }
  );

  const output = result.object;

  console.log('Strategy:', output.summary, '\n');
  console.log(`Recommended Transformations (${output.transformations.length}):`);
  output.transformations.forEach((t, i) => {
    const desc = t.type === 'greenhouse'
      ? `${t.param} -> ${t.value}`
      : `${t.crop}.${t.param} -> ${t.value}`;
    console.log(`   ${i + 1}. ${desc}`);
    console.log(`      ${t.reasoning}`);
  });

  console.log('\nApplying transformations...\n');
  const finalState = applyTransformations(initialState, time, output.transformations);
  const finalEnv = finalState.simulation.getEnvironment(time);

  console.log('Final State:');
  console.log(`   Temp: ${finalEnv.airTemperature.toFixed(1)}°C | Humidity: ${finalEnv.humidity.toFixed(1)}%`);
  console.log(`   CO2: ${finalEnv.co2Level.toFixed(0)}ppm`);
  for (const ct of ALL_CROP_TYPES) {
    console.log(`   ${ct}: soil ${finalEnv.crops[ct].soilMoisture.toFixed(1)}% | growth ${finalEnv.crops[ct].plantGrowth.toFixed(1)}%`);
  }
}

main().catch(console.error);
