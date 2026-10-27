/** ECharts with only the parts this site uses, so the bundle stays small. */

import { BarChart, LineChart } from 'echarts/charts';
import {
  AxisPointerComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
} from 'echarts/components';
import {
  type ECharts,
  type EChartsCoreOption,
  getInstanceByDom,
  init,
  use as registerComponents,
} from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

registerComponents([
  BarChart,
  LineChart,
  AxisPointerComponent,
  GraphicComponent,
  GridComponent,
  LegendComponent,
  TitleComponent,
  TooltipComponent,
  CanvasRenderer,
]);

export { getInstanceByDom, init };
export type { ECharts };
export type ChartOption = EChartsCoreOption;

/** Reads a design token from the stylesheet. */
export const css = (name: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim();

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
