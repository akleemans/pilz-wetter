/** One day of weather, as the model consumes it. Missing values are `null`. */
export interface DayWeather {
  /** ISO date, `YYYY-MM-DD`. */
  readonly date: string;
  readonly tMin: number | null;
  readonly tMean: number | null;
  readonly tMax: number | null;
  /** Daily precipitation sum in mm (rain and snow water equivalent). */
  readonly precip: number | null;
}

/** The scored factors of one day, each in 0..1 unless noted. */
export interface ScoreComponents {
  readonly moisture: number;
  readonly sustain: number;
  readonly flush: number;
  readonly temperature: number;
  readonly tempGate: number;
  /** Product of the frost / heat / rain / waterlogging / diurnal modifiers. */
  readonly modifier: number;
  readonly season: number;
}
