import { Environment, GreenhouseState, SimulationState, State } from '../../state/types';

// Crop-specific environment readings
export interface CropEnvironment {
  soilMoisture: number; // percentage
  soilTemperature: number; // Celsius
  plantGrowth: number; // 0-100%
  leafArea: number; // m²
  fruitCount: number;
}

// Crop-specific machine outputs
export interface CropControls {
  waterPumpRate: number; // L/hour
  localHeatingPower: number; // Watts
}

// Concrete Environment with per-crop data
export class ConcreteEnvironment extends Environment {
  timestamp: number;
  
  // Global greenhouse readings
  airTemperature: number; // Celsius
  humidity: number; // percentage
  co2Level: number; // ppm
  lightLevel: number; // lux
  externalTemp: number; // Mars outside temp
  solarRadiation: number; // W/m²
  
  // Per-crop readings
  tomatoes: CropEnvironment;
  carrots: CropEnvironment;

  constructor(data: {
    timestamp: number;
    airTemperature: number;
    humidity: number;
    co2Level: number;
    lightLevel: number;
    externalTemp: number;
    solarRadiation: number;
    tomatoes: CropEnvironment;
    carrots: CropEnvironment;
  }) {
    super();
    this.timestamp = data.timestamp;
    this.airTemperature = data.airTemperature;
    this.humidity = data.humidity;
    this.co2Level = data.co2Level;
    this.lightLevel = data.lightLevel;
    this.externalTemp = data.externalTemp;
    this.solarRadiation = data.solarRadiation;
    this.tomatoes = data.tomatoes;
    this.carrots = data.carrots;
  }
}

// Concrete GreenhouseState with per-crop controls
export class ConcreteGreenhouseState extends GreenhouseState {
  // Global controls
  lightingPower: number; // Watts
  globalHeatingPower: number; // Watts
  co2InjectionRate: number; // ppm/hour
  ventilationRate: number; // m³/hour
  
  // Per-crop controls
  tomatoes: CropControls;
  carrots: CropControls;

  constructor(data: {
    lightingPower: number;
    globalHeatingPower: number;
    co2InjectionRate: number;
    ventilationRate: number;
    tomatoes: CropControls;
    carrots: CropControls;
  }) {
    super();
    this.lightingPower = data.lightingPower;
    this.globalHeatingPower = data.globalHeatingPower;
    this.co2InjectionRate = data.co2InjectionRate;
    this.ventilationRate = data.ventilationRate;
    this.tomatoes = data.tomatoes;
    this.carrots = data.carrots;
  }
}

// Concrete SimulationState
export class ConcreteSimulationState extends SimulationState {
  private initialEnv: ConcreteEnvironment;
  private greenhouse: ConcreteGreenhouseState;

  constructor(initialEnv: ConcreteEnvironment, greenhouse: ConcreteGreenhouseState) {
    super();
    this.initialEnv = initialEnv;
    this.greenhouse = greenhouse;
  }

  getEnvironment(time: number): Environment {
    const deltaHours = time / 60;

    // Mars external conditions (natural changes)
    const timeOfDay = (Date.now() / 3600000) % 24;
    const solarFactor = Math.max(0, Math.sin((timeOfDay / 24) * 2 * Math.PI));
    const externalTemp = -63 + (30 * solarFactor) + this.randomVariation(3);
    const solarRadiation = 590 * solarFactor + this.randomVariation(30);

    // Global air temperature
    let airTemp = this.initialEnv.airTemperature;
    airTemp += (this.greenhouse.globalHeatingPower / 1000) * deltaHours;
    airTemp += (solarRadiation / 500) * deltaHours;
    airTemp -= (airTemp - externalTemp) * 0.05 * deltaHours;
    airTemp -= this.greenhouse.ventilationRate * 0.01 * deltaHours;

    // Humidity
    let humidity = this.initialEnv.humidity;
    const avgSoilMoisture = (this.initialEnv.tomatoes.soilMoisture + this.initialEnv.carrots.soilMoisture) / 2;
    humidity += (avgSoilMoisture - humidity) * 0.1 * deltaHours;
    humidity -= this.greenhouse.ventilationRate * 0.05 * deltaHours;
    humidity = Math.max(0, Math.min(100, humidity));

    // CO2 level
    let co2Level = this.initialEnv.co2Level;
    co2Level += this.greenhouse.co2InjectionRate * deltaHours;
    co2Level -= (this.greenhouse.lightingPower / 100) * deltaHours;
    co2Level -= this.greenhouse.ventilationRate * 0.5 * deltaHours;
    co2Level = Math.max(400, co2Level);

    // Light level
    const lightLevel = (this.greenhouse.lightingPower * 2) + (solarRadiation * 5);

    // Simulate tomatoes
    const tomatoes = this.simulateCrop(
      this.initialEnv.tomatoes,
      this.greenhouse.tomatoes,
      airTemp,
      humidity,
      co2Level,
      lightLevel,
      deltaHours,
      { optimalTemp: 22, optimalMoisture: 70 }
    );

    // Simulate carrots
    const carrots = this.simulateCrop(
      this.initialEnv.carrots,
      this.greenhouse.carrots,
      airTemp,
      humidity,
      co2Level,
      lightLevel,
      deltaHours,
      { optimalTemp: 18, optimalMoisture: 65 }
    );

    return new ConcreteEnvironment({
      timestamp: Date.now(),
      airTemperature: airTemp,
      humidity,
      co2Level,
      lightLevel,
      externalTemp,
      solarRadiation,
      tomatoes,
      carrots,
    });
  }

  private simulateCrop(
    initial: CropEnvironment,
    controls: CropControls,
    airTemp: number,
    humidity: number,
    co2Level: number,
    lightLevel: number,
    deltaHours: number,
    params: { optimalTemp: number; optimalMoisture: number }
  ): CropEnvironment {
    // Soil temperature (influenced by air temp and local heating)
    let soilTemp = initial.soilTemperature;
    soilTemp += (controls.localHeatingPower / 500) * deltaHours;
    soilTemp += (airTemp - soilTemp) * 0.2 * deltaHours;

    // Soil moisture (water pump adds, evaporation removes)
    let soilMoisture = initial.soilMoisture;
    soilMoisture += controls.waterPumpRate * deltaHours * 0.5;
    soilMoisture -= 2 * deltaHours; // Evaporation and plant uptake
    soilMoisture = Math.max(0, Math.min(100, soilMoisture));

    // Plant growth (depends on optimal conditions)
    let plantGrowth = initial.plantGrowth;
    const growthRate = this.calculateGrowthRate(
      soilTemp,
      soilMoisture,
      airTemp,
      humidity,
      co2Level,
      lightLevel,
      params
    );
    plantGrowth = Math.min(100, plantGrowth + growthRate * deltaHours);

    // Leaf area (grows with plant)
    let leafArea = initial.leafArea;
    leafArea += (plantGrowth / 100) * 0.1 * deltaHours;

    // Fruit count (appears after 50% growth)
    let fruitCount = initial.fruitCount;
    if (plantGrowth > 50) {
      fruitCount += 0.05 * deltaHours * (plantGrowth / 100);
    }

    return {
      soilMoisture,
      soilTemperature: soilTemp,
      plantGrowth,
      leafArea,
      fruitCount: Math.floor(fruitCount),
    };
  }

  private calculateGrowthRate(
    soilTemp: number,
    soilMoisture: number,
    airTemp: number,
    humidity: number,
    co2Level: number,
    lightLevel: number,
    params: { optimalTemp: number; optimalMoisture: number }
  ): number {
    let rate = 0.5; // Base rate per hour

    // Soil temperature factor
    const tempDiff = Math.abs(soilTemp - params.optimalTemp);
    if (tempDiff < 3) rate *= 1.5;
    else if (tempDiff > 10) rate *= 0.3;

    // Soil moisture factor
    const moistureDiff = Math.abs(soilMoisture - params.optimalMoisture);
    if (moistureDiff < 10) rate *= 1.3;
    else if (moistureDiff > 30) rate *= 0.2;

    // Air temperature factor
    if (airTemp >= 18 && airTemp <= 25) rate *= 1.2;
    else if (airTemp < 10 || airTemp > 35) rate *= 0.4;

    // CO2 factor
    if (co2Level > 1000) rate *= 1.2;
    else if (co2Level < 600) rate *= 0.7;

    // Light factor
    if (lightLevel > 8000) rate *= 1.4;
    else if (lightLevel < 3000) rate *= 0.5;

    // Humidity factor
    if (humidity >= 60 && humidity <= 80) rate *= 1.2;
    else if (humidity < 40) rate *= 0.6;

    return rate;
  }

  private randomVariation(range: number): number {
    return (Math.random() - 0.5) * range;
  }
}

// Concrete State
export class ConcreteState extends State {
  simulation: ConcreteSimulationState;
  greenhouse: ConcreteGreenhouseState;

  constructor(simulation: ConcreteSimulationState, greenhouse: ConcreteGreenhouseState) {
    super();
    this.simulation = simulation;
    this.greenhouse = greenhouse;
  }
}
