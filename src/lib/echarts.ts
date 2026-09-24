import { BarChart, HeatmapChart, LineChart } from 'echarts/charts';
import {
    DataZoomComponent,
    GridComponent,
    LegendComponent,
    TooltipComponent,
    VisualMapComponent
} from 'echarts/components';
import * as echarts from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
    BarChart,
    HeatmapChart,
    LineChart,
    DataZoomComponent,
    GridComponent,
    LegendComponent,
    TooltipComponent,
    VisualMapComponent,
    CanvasRenderer
]);

export { echarts };
