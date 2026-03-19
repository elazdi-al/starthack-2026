import { DecideFunction } from '../../decision';
import { ConcreteGreenhouseState, ConcreteEnvironment } from './types';

// Example decision function: simple rule-based control
export const simpleDecide: DecideFunction = (environment, currentGreenhouse) => {
  const env = environment as ConcreteEnvironment;
  const greenhouse = currentGreenhouse as ConcreteGreenhouseState;

  // Clone current greenhouse state
  const newGreenhouse = new ConcreteGreenhouseState({
    lightingPower: greenhouse.lightingPower,
    globalHeatingPower: greenhouse.globalHeatingPower,
    co2InjectionRate: greenhouse.co2InjectionRate,
    ventilationRate: greenhouse.ventilationRate,
    tomatoes: { ...greenhouse.tomatoes },
    carrots: { ...greenhouse.carrots },
  });

  // Adjust global heating based on air temperature
  if (env.airTemperature < 18) {
    newGreenhouse.globalHeatingPower = 5000;
  } else if (env.airTemperature > 25) {
    newGreenhouse.globalHeatingPower = 1000;
  }

  // Adjust CO2 injection based on level
  if (env.co2Level < 800) {
    newGreenhouse.co2InjectionRate = 100;
  } else if (env.co2Level > 1200) {
    newGreenhouse.co2InjectionRate = 20;
  }

  // Adjust tomato watering based on soil moisture
  if (env.tomatoes.soilMoisture < 60) {
    newGreenhouse.tomatoes.waterPumpRate = 15;
  } else if (env.tomatoes.soilMoisture > 80) {
    newGreenhouse.tomatoes.waterPumpRate = 5;
  }

  // Adjust carrot watering based on soil moisture
  if (env.carrots.soilMoisture < 55) {
    newGreenhouse.carrots.waterPumpRate = 12;
  } else if (env.carrots.soilMoisture > 75) {
    newGreenhouse.carrots.waterPumpRate = 4;
  }

  return newGreenhouse;
};
