import { EnvironmentState, GreenhouseState } from './types';

// Simulation function: computes next environment state from current state + machine outputs
export function simulate(
  currentEnv: EnvironmentState,
  greenhouse: GreenhouseState,
  deltaMinutes: number
): EnvironmentState {
  const deltaHours = deltaMinutes / 60;

  // Mars external conditions (natural changes)
  const timeOfDay = (Date.now() / 3600000) % 24; // Simple day cycle
  const solarFactor = Math.max(0, Math.sin((timeOfDay / 24) * 2 * Math.PI));
  const externalTemp = -63 + (30 * solarFactor) + randomVariation(3);
  const solarRadiation = 590 * solarFactor + randomVariation(30);

  // Temperature: affected by heating, external temp, and solar radiation
  let temperature = currentEnv.temperature;
  temperature += (greenhouse.heatingPower / 1000) * deltaHours; // Heating adds warmth
  temperature += (solarRadiation / 500) * deltaHours; // Solar heating
  temperature -= (temperature - externalTemp) * 0.05 * deltaHours; // Heat loss to Mars
  temperature -= greenhouse.ventilationRate * 0.01 * deltaHours; // Ventilation cools

  // Soil moisture: affected by water pump
  let soilMoisture = currentEnv.soilMoisture;
  soilMoisture += greenhouse.waterPumpRate * deltaHours * 0.5; // Water adds moisture
  soilMoisture -= 2 * deltaHours; // Natural evaporation/consumption
  soilMoisture = Math.max(0, Math.min(100, soilMoisture));

  // Humidity: correlates with soil moisture and ventilation
  let humidity = currentEnv.humidity;
  humidity += (soilMoisture - humidity) * 0.1 * deltaHours;
  humidity -= greenhouse.ventilationRate * 0.05 * deltaHours;
  humidity = Math.max(0, Math.min(100, humidity));

  // CO2: affected by injection, plant consumption, and ventilation
  let co2Level = currentEnv.co2Level;
  co2Level += greenhouse.co2InjectionRate * deltaHours; // Injection adds CO2
  co2Level -= (greenhouse.lightingPower / 100) * deltaHours; // Plants consume during photosynthesis
  co2Level -= greenhouse.ventilationRate * 0.5 * deltaHours; // Ventilation removes CO2
  co2Level = Math.max(400, co2Level); // Minimum atmospheric CO2

  // Light level: from artificial lighting + solar
  const lightLevel = (greenhouse.lightingPower * 2) + (solarRadiation * 5);

  // Plant growth: depends on optimal conditions
  let plantGrowth = currentEnv.plantGrowth;
  const growthRate = calculateGrowthRate(temperature, humidity, co2Level, soilMoisture, lightLevel);
  plantGrowth = Math.min(100, plantGrowth + growthRate * deltaHours);

  return {
    timestamp: Date.now(),
    temperature,
    humidity,
    co2Level,
    soilMoisture,
    lightLevel,
    plantGrowth,
    externalTemp,
    solarRadiation,
  };
}

function calculateGrowthRate(
  temp: number,
  humidity: number,
  co2: number,
  moisture: number,
  light: number
): number {
  let rate = 0.5; // Base rate per hour

  // Temperature factor (optimal 18-25°C)
  if (temp >= 18 && temp <= 25) rate *= 1.5;
  else if (temp < 10 || temp > 35) rate *= 0.3;

  // Moisture factor (optimal 60-80%)
  if (moisture >= 60 && moisture <= 80) rate *= 1.3;
  else if (moisture < 30) rate *= 0.2;

  // CO2 factor (optimal >1000 ppm)
  if (co2 > 1000) rate *= 1.2;
  else if (co2 < 600) rate *= 0.7;

  // Light factor (optimal >8000 lux)
  if (light > 8000) rate *= 1.4;
  else if (light < 3000) rate *= 0.5;

  // Humidity factor (optimal 60-80%)
  if (humidity >= 60 && humidity <= 80) rate *= 1.2;
  else if (humidity < 40) rate *= 0.6;

  return rate;
}

function randomVariation(range: number): number {
  return (Math.random() - 0.5) * range;
}
