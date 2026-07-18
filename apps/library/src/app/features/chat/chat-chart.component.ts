import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  ViewChild,
} from '@angular/core';
import type { ChatChart } from '@library-app/shared-models';
import { BarChart, LineChart, PieChart } from 'echarts/charts';
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
import { init, use, type ECharts, type EChartsCoreOption } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

use([
  AriaComponent,
  BarChart,
  CanvasRenderer,
  DataZoomComponent,
  GridComponent,
  LegendComponent,
  LineChart,
  PieChart,
  ToolboxComponent,
  TooltipComponent,
]);

@Component({
  selector: 'app-chat-chart',
  template: `
    <figure class="chart-card" [attr.aria-label]="chart.title">
      <figcaption>
        <span class="chart-card__eyebrow">Interactive chart</span>
        <strong>{{ chart.title }}</strong>
        @if (chart.description) {
          <span class="chart-card__description">{{ chart.description }}</span>
        }
      </figcaption>
      <div #chartContainer class="chart-card__canvas"></div>
    </figure>
  `,
  styleUrl: './chat-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ChatChartComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input({ required: true }) chart!: ChatChart;
  @ViewChild('chartContainer', { static: true })
  private chartContainer!: ElementRef<HTMLElement>;

  private instance?: ECharts;
  private resizeObserver?: ResizeObserver;

  ngAfterViewInit(): void {
    this.instance = init(this.chartContainer.nativeElement, undefined, {
      renderer: 'canvas',
    });
    this.render();
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.instance?.resize());
      this.resizeObserver.observe(this.chartContainer.nativeElement);
    }
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['chart'] && this.instance) {
      this.render();
    }
  }

  ngOnDestroy(): void {
    this.resizeObserver?.disconnect();
    this.instance?.dispose();
  }

  private render(): void {
    this.instance?.setOption(this.options(), true);
  }

  private options(): EChartsCoreOption {
    const palette = ['#315c47', '#bc654d', '#d2a444', '#5b7f95', '#8a6f9b'];
    if (this.chart.kind === 'pie') {
      return {
        aria: { enabled: true, decal: { show: true } },
        color: palette,
        legend: { bottom: 0, type: 'scroll' },
        tooltip: { trigger: 'item' },
        toolbox: {
          right: 8,
          feature: { saveAsImage: { title: 'Save image' } },
        },
        series: this.chart.series.map((series) => ({
          name: series.name,
          type: 'pie',
          radius: ['38%', '68%'],
          center: ['50%', '43%'],
          data: series.data.map((point) => ({
            name: point.label,
            value: point.value,
          })),
          emphasis: { scale: true },
        })),
      };
    }

    const labels = [
      ...new Set(
        this.chart.series.flatMap((series) =>
          series.data.map((point) => point.label),
        ),
      ),
    ];
    const useZoom = labels.length > 12;
    const seriesType = this.chart.kind === 'bar' ? 'bar' : 'line';

    return {
      aria: { enabled: true, decal: { show: true } },
      color: palette,
      grid: {
        top: 44,
        right: 24,
        bottom: useZoom ? 76 : 48,
        left: 54,
        containLabel: true,
      },
      legend: { top: 4, type: 'scroll' },
      tooltip: { trigger: 'axis' },
      toolbox: { right: 8, feature: { saveAsImage: { title: 'Save image' } } },
      xAxis: {
        type: 'category',
        name: this.chart.xAxisLabel,
        nameLocation: 'middle',
        nameGap: 34,
        data: labels,
        axisLabel: { hideOverlap: true },
      },
      yAxis: {
        type: 'value',
        name: this.chart.yAxisLabel,
        minInterval: 1,
      },
      dataZoom: useZoom
        ? [{ type: 'inside' }, { type: 'slider', height: 18, bottom: 8 }]
        : [],
      series: this.chart.series.map((series) => ({
        name: series.name,
        type: seriesType,
        smooth: seriesType === 'line',
        showSymbol: labels.length <= 30,
        areaStyle: this.chart.kind === 'area' ? { opacity: 0.18 } : undefined,
        data: labels.map(
          (label) =>
            series.data.find((point) => point.label === label)?.value ?? null,
        ),
      })),
    };
  }
}
