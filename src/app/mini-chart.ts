/** The small six-week weather + score chart on each scenario card. */

import type { DayScore } from '../model/score.ts';
import type { DayWeather } from '../model/types.ts';
import { css, type ECharts, FONT, getInstanceByDom, init } from './echarts.ts';
import { ratingColor } from './chart.ts';

export function renderMiniChart(
  el: HTMLElement,
  days: ReadonlyArray<DayWeather>,
  scores: ReadonlyArray<DayScore>,
): ECharts {
  const chart = getInstanceByDom(el) ?? init(el, null, { renderer: 'canvas' });
  const muted = css('--text-muted');
  const gridline = css('--gridline');
  const ink = css('--text-primary');
  const labels = days.map((_, i) => `${i - days.length + 1}`);

  chart.setOption(
    {
      animation: false,
      textStyle: { fontFamily: FONT },
      grid: [
        { left: 34, right: 34, top: 20, height: 56 },
        { left: 34, right: 34, top: 98, height: 44 },
      ],
      tooltip: {
        trigger: 'axis',
        backgroundColor: css('--surface-1'),
        borderColor: css('--border'),
        textStyle: { color: ink, fontSize: 12 },
        formatter: (p: unknown) => {
          const i = (p as Array<{ dataIndex: number }>)[0]?.dataIndex ?? 0;
          const d = days[i]!;
          const age = days.length - 1 - i;
          return `${age === 0 ? 'Bewerteter Tag' : `vor ${age} Tagen`}<br>
            ${d.precip ?? 0} mm · ${d.tMin ?? '–'} / ${d.tMean ?? '–'} / ${d.tMax ?? '–'} °C<br>
            Index ${scores[i]!.score}`;
        },
      },
      axisPointer: { link: [{ xAxisIndex: 'all' }] },
      xAxis: [0, 1].map((gridIndex) => ({
        type: 'category',
        gridIndex,
        data: labels,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: gridline } },
        axisLabel:
          gridIndex === 1
            ? {
                color: muted,
                fontSize: 10,
                interval: (i: number) => (days.length - 1 - i) % 7 === 0,
                formatter: (v: string) => (v === '0' ? 'heute' : `${v} T.`),
              }
            : { show: false },
      })),
      yAxis: [
        {
          type: 'value',
          gridIndex: 0,
          min: 0,
          splitNumber: 2,
          axisLabel: { color: muted, fontSize: 10 },
          splitLine: { lineStyle: { color: gridline } },
          name: 'mm',
          nameTextStyle: { color: muted, fontSize: 10 },
          nameGap: 4,
        },
        {
          type: 'value',
          gridIndex: 0,
          scale: true,
          splitNumber: 2,
          position: 'right',
          axisLabel: { color: muted, fontSize: 10 },
          splitLine: { show: false },
          name: '°C',
          nameTextStyle: { color: muted, fontSize: 10 },
          nameGap: 4,
        },
        {
          type: 'value',
          gridIndex: 1,
          min: 0,
          max: 100,
          interval: 50,
          axisLabel: { color: muted, fontSize: 10 },
          splitLine: { lineStyle: { color: gridline } },
        },
      ],
      series: [
        {
          type: 'bar',
          xAxisIndex: 0,
          yAxisIndex: 0,
          data: days.map((d) => d.precip ?? 0),
          itemStyle: { color: css('--precip') },
          barWidth: '60%',
        },
        {
          type: 'line',
          xAxisIndex: 0,
          yAxisIndex: 1,
          data: days.map((d) => d.tMean),
          symbol: 'none',
          lineStyle: { color: css('--temp-mean'), width: 1.5 },
        },
        {
          type: 'bar',
          xAxisIndex: 1,
          yAxisIndex: 2,
          barWidth: '60%',
          data: scores.map((s, i) => ({
            value: s.score,
            itemStyle: {
              color: ratingColor(s.rating.key),
              opacity: i === scores.length - 1 ? 1 : 0.45,
            },
          })),
        },
      ],
    },
    true,
  );
  return chart;
}
