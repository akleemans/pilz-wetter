/**
 * The main chart: temperature, precipitation and the Pilz-Index as three
 * stacked panels on one shared time axis.
 */

import { noteText } from '../model/notes.ts';
import type { ModelParams } from '../model/params.ts';
import { type ChartOption, css, type ECharts, FONT, init } from './echarts.ts';
import { dayParts, formatDay, formatNumber, formatPercent, formatShort } from './format.ts';
import type { Row } from './timeline.ts';

const GRID_MARGIN = { left: 56, right: 76 };
const GRID_LAYOUT = [
  { top: 34, height: 190 },
  { top: 296, height: 100 },
  { top: 458, height: 110 },
];

export const ratingColor = (key: string) => css(`--rating-${key}`);

const titleStyle = (color: string) => ({ color, fontSize: 13, fontWeight: 600, fontFamily: FONT });
const subtitleStyle = (color: string) => ({ color, fontSize: 11, fontFamily: FONT });

export class MainChart {
  private chart: ECharts | undefined;
  private rows: ReadonlyArray<Row> = [];
  private params: ModelParams | undefined;
  private wasNarrow = false;

  constructor(private readonly el: HTMLElement) {
    window.addEventListener('resize', () => {
      // Crossing the phone breakpoint changes the axis labels: redraw.
      if (this.params && this.isNarrow !== this.wasNarrow) {
        this.render(this.rows, this.params);
        return;
      }
      this.chart?.resize();
      this.drawForecastBand();
    });
  }

  render(rows: ReadonlyArray<Row>, params: ModelParams) {
    this.rows = rows;
    this.params = params;
    this.wasNarrow = this.isNarrow;
    this.chart?.dispose();
    this.chart = init(this.el, null, { renderer: 'canvas' });
    this.chart.setOption(this.option(rows, params));
    this.drawForecastBand();
  }

  private get isNarrow() {
    return this.el.clientWidth < 600;
  }

  private option(rows: ReadonlyArray<Row>, params: ModelParams): ChartOption {
    const surface = css('--surface-1');
    const ink = css('--text-primary');
    const muted = css('--text-muted');
    const secondary = css('--text-secondary');
    const gridline = css('--gridline');
    const axis = css('--axis');

    const narrow = this.isNarrow;
    const todayIndex = Math.max(
      0,
      rows.findIndex((r) => r.isToday),
    );

    const tempSeries = [
      { name: 'Max', key: 'tMax', color: css('--temp-max') },
      { name: 'Mittel', key: 'tMean', color: css('--temp-mean') },
      { name: 'Min', key: 'tMin', color: css('--temp-min') },
    ] as const;

    const axisCommon = {
      type: 'category',
      data: rows.map((r) => formatShort(r.date)),
      boundaryGap: true,
      axisLine: { lineStyle: { color: axis } },
      axisTick: { show: false },
      axisPointer: { label: { show: false } },
    };

    const valueAxis = {
      type: 'value',
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: gridline, type: 'solid', width: 1 } },
      axisLabel: { color: muted, fontSize: 11 },
    };

    const panelTitle = (text: string, subtext: string, top: number) => ({
      text,
      subtext,
      top,
      left: 0,
      itemGap: 0,
      textStyle: titleStyle(ink),
      subtextStyle: subtitleStyle(muted),
    });

    return {
      backgroundColor: 'transparent',
      animationDuration: 420,
      textStyle: { fontFamily: FONT },
      title: [
        panelTitle('Temperatur', '°C', 0),
        panelTitle('Niederschlag', 'mm pro Tag', 258),
        panelTitle('Pilz-Index', '0–100', 420),
      ],
      legend: {
        top: -2,
        right: 0,
        icon: 'circle',
        itemWidth: 9,
        itemHeight: 9,
        itemGap: 18,
        textStyle: { color: secondary, fontSize: 12 },
        data: tempSeries.map((s) => s.name),
      },
      grid: GRID_LAYOUT.map((g) => ({ ...GRID_MARGIN, ...g })),
      axisPointer: { link: [{ xAxisIndex: 'all' }], lineStyle: { color: axis, width: 1 } },
      tooltip: {
        trigger: 'axis',
        backgroundColor: surface,
        borderColor: css('--border'),
        borderWidth: 1,
        padding: [12, 14],
        textStyle: { color: ink, fontSize: 12 },
        extraCssText: 'box-shadow:0 6px 24px rgba(0,0,0,.14);max-width:340px;white-space:normal;',
        formatter: (p: unknown) => {
          const index = (p as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0;
          return tooltipHtml(rows[index]!, params, muted, secondary);
        },
      },
      xAxis: [
        { ...axisCommon, gridIndex: 0, axisLabel: { show: false } },
        { ...axisCommon, gridIndex: 1, axisLabel: { show: false } },
        {
          ...axisCommon,
          gridIndex: 2,
          axisLabel: {
            color: muted,
            fontSize: 11,
            // On a phone, 17 dates do not fit: label every third day, counted
            // from today so that today always keeps its label.
            interval: narrow ? (i: number) => (i - todayIndex) % 3 === 0 : 0,
            lineHeight: 14,
            // Two short lines instead of rotation: nothing clips at the edges.
            formatter: (_v: string, i: number) => {
              const { weekday, day, month } = dayParts(rows[i]!.date);
              const date = narrow ? day : `${day} ${month}`;
              return rows[i]!.isToday
                ? `{today|${weekday}}\n{today|${date}}`
                : `${weekday}\n${date}`;
            },
            rich: { today: { color: ink, fontWeight: 700, lineHeight: 14 } },
          },
        },
      ],
      yAxis: [
        { ...valueAxis, gridIndex: 0, scale: true },
        { ...valueAxis, gridIndex: 1, min: 0, minInterval: 1 },
        { ...valueAxis, gridIndex: 2, min: 0, max: 100, interval: 25 },
      ],
      series: [
        ...tempSeries.map((s, idx) => ({
          name: s.name,
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: rows.map((r) => r[s.key]),
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: { width: 2, color: s.color },
          itemStyle: { color: s.color, borderColor: surface, borderWidth: 2 },
          emphasis: { scale: 1.35, focus: 'none' },
          z: 3 - idx,
          // Direct label at the endpoint, so identity never rests on colour alone.
          label: {
            show: true,
            position: 'right',
            distance: 8,
            color: s.color,
            fontSize: 11,
            fontWeight: 600,
            formatter: ({ dataIndex, value }: { dataIndex: number; value: number | null }) =>
              dataIndex === rows.length - 1 && value != null
                ? `${s.name} ${Math.round(value)}°`
                : '',
          },
        })),
        {
          name: 'Niederschlag',
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 1,
          data: rows.map((r) => r.precip),
          barWidth: '54%',
          itemStyle: {
            color: css('--precip'),
            borderRadius: [4, 4, 0, 0],
            borderColor: surface,
            borderWidth: 1,
          },
          label: {
            show: true,
            position: 'top',
            color: secondary,
            fontSize: 11,
            formatter: ({ value }: { value: number | null }) =>
              value != null && value >= 5 ? value.toFixed(0) : '',
          },
        },
        {
          name: 'Index',
          type: 'bar',
          xAxisIndex: 2,
          yAxisIndex: 2,
          data: rows.map((r) => ({
            value: r.score,
            itemStyle: {
              color: ratingColor(r.rating.key),
              borderRadius: [4, 4, 0, 0],
              borderColor: surface,
              borderWidth: 1,
              opacity: r.isForecast ? 0.82 : 1,
            },
          })),
          barWidth: '54%',
          label: {
            show: true,
            position: 'top',
            color: ink,
            fontSize: 11,
            fontWeight: 600,
            // Selective: only today and the forecast carry a printed number
            // (on a phone only today; the tiles above list the forecast).
            formatter: ({ dataIndex, value }: { dataIndex: number; value: number }) =>
              rows[dataIndex]!.isToday || (!narrow && rows[dataIndex]!.isForecast)
                ? String(value)
                : '',
          },
        },
      ],
    };
  }

  /**
   * The forecast band is drawn from pixel geometry rather than with markArea:
   * markArea's category coordinates round differently depending on the chart
   * width, which drifted the band on narrow screens. Re-run on resize.
   */
  private drawForecastBand() {
    const chart = this.chart;
    const firstForecast = this.rows.findIndex((r) => r.isForecast);
    if (!chart || firstForecast <= 0) {
      return;
    }
    const plotWidth = chart.getWidth() - GRID_MARGIN.left - GRID_MARGIN.right;
    const cellWidth = plotWidth / this.rows.length;
    const left = GRID_MARGIN.left + firstForecast * cellWidth;
    const right = GRID_MARGIN.left + plotWidth;
    const muted = css('--text-muted');
    chart.setOption({
      graphic: [
        ...GRID_LAYOUT.map((g, i) => ({
          id: `forecast-band-${i}`,
          type: 'rect',
          silent: true,
          z: -10,
          x: left,
          y: g.top,
          shape: { width: right - left, height: g.height },
          style: { fill: muted, opacity: 0.07 },
        })),
        {
          id: 'forecast-label',
          type: 'text',
          right: 78,
          top: 34,
          style: { text: 'Prognose →', fill: muted, fontSize: 11, textAlign: 'right' },
        },
      ],
    });
  }
}

function tooltipHtml(row: Row, params: ModelParams, muted: string, secondary: string) {
  const c = row.components;
  const line = (label: string, value: string) =>
    `<div style="display:flex;justify-content:space-between;gap:18px">
       <span style="color:${secondary}">${label}</span><span>${value}</span>
     </div>`;

  return `
    <div style="font-weight:600;margin-bottom:6px">
      ${formatDay(row.date)}${row.isForecast ? ' · Prognose' : ''}
    </div>
    ${line('Max / Mittel / Min', `${formatNumber(row.tMax)} / ${formatNumber(row.tMean)} / ${formatNumber(row.tMin)} °C`)}
    ${line('Niederschlag', `${formatNumber(row.precip)} mm`)}
    <div style="height:8px"></div>
    <div style="display:flex;align-items:center;gap:8px;font-weight:600">
      <span style="width:10px;height:10px;border-radius:50%;background:${ratingColor(row.rating.key)}"></span>
      Index ${row.score} / 100 · ${row.rating.label}
    </div>
    <div style="height:6px"></div>
    ${line('Bodenfeuchte', formatPercent(c.moisture))}
    ${line('Anhaltende Feuchte', formatPercent(c.sustain))}
    ${line('Auslösender Regen (3–10 T.)', formatPercent(c.flush))}
    ${line('Temperatur', formatPercent(c.temperature))}
    ${line('Saison', formatPercent(c.season))}
    ${line('Bodenwasserspeicher', `${row.soilIndex.toFixed(0)} / ${params.fieldCapacity} mm`)}
    ${
      row.notes.length
        ? `<div style="margin-top:8px;color:${muted};line-height:1.4">${row.notes
            .slice(0, 3)
            .map(noteText)
            .join('<br>')}</div>`
        : ''
    }`;
}
