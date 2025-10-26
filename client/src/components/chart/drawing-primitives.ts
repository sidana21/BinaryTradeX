/**
 * TradingView Drawing Primitives - Professional Drawing Tools
 * Using Official TradingView Lightweight Charts Plugin System
 */

import { ISeriesPrimitive, SeriesAttachedParameter, Time } from 'lightweight-charts';

// ============================================================================
// Base Drawing Primitive Class
// ============================================================================

export interface DrawingPoint {
  time: Time;
  price: number;
}

export interface DrawingOptions {
  color?: string;
  lineWidth?: number;
  lineStyle?: 'solid' | 'dashed' | 'dotted';
  showHandles?: boolean;
  editable?: boolean;
}

abstract class BaseDrawingPrimitive implements ISeriesPrimitive<Time> {
  protected _chart: any = null;
  protected _series: any = null;
  protected _points: DrawingPoint[] = [];
  protected _options: DrawingOptions;
  protected _paneViews: any[] = [];
  protected _isHovered: boolean = false;
  protected _isDragging: boolean = false;
  protected _dragPointIndex: number = -1;

  constructor(points: DrawingPoint[], options: DrawingOptions = {}) {
    this._points = points;
    this._options = {
      color: options.color || '#2196F3',
      lineWidth: options.lineWidth || 2,
      lineStyle: options.lineStyle || 'solid',
      showHandles: options.showHandles !== false,
      editable: options.editable !== false,
    };
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this._chart = param.chart;
    this._series = param.series;
    this.updateAllViews();
  }

  detached(): void {
    this._chart = null;
    this._series = null;
  }

  updateAllViews(): void {
    this._paneViews.forEach(view => view.update());
  }

  paneViews() {
    return this._paneViews;
  }

  // Get point coordinates
  protected _timeToX(time: Time): number | null {
    if (!this._chart) return null;
    return this._chart.timeScale().timeToCoordinate(time);
  }

  protected _priceToY(price: number): number | null {
    if (!this._series) return null;
    return this._series.priceToCoordinate(price);
  }

  // Handle interaction
  public setHovered(hovered: boolean): void {
    this._isHovered = hovered;
    this.updateAllViews();
  }

  public startDrag(pointIndex: number): void {
    if (!this._options.editable) return;
    this._isDragging = true;
    this._dragPointIndex = pointIndex;
  }

  public updateDragPoint(time: Time, price: number): void {
    if (!this._isDragging || this._dragPointIndex < 0) return;
    this._points[this._dragPointIndex] = { time, price };
    this.updateAllViews();
  }

  public endDrag(): void {
    this._isDragging = false;
    this._dragPointIndex = -1;
  }

  public getPoints(): DrawingPoint[] {
    return this._points;
  }

  public setPoints(points: DrawingPoint[]): void {
    this._points = points;
    this.updateAllViews();
  }
}

// ============================================================================
// Trendline Primitive
// ============================================================================

class TrendlinePaneView {
  private _primitive: TrendlinePrimitive;

  constructor(primitive: TrendlinePrimitive) {
    this._primitive = primitive;
  }

  renderer() {
    return new TrendlineRenderer(this._primitive);
  }

  update() {
    // View updates automatically when renderer is called
  }
}

class TrendlineRenderer {
  private _primitive: TrendlinePrimitive;

  constructor(primitive: TrendlinePrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    const points = this._primitive.getPoints();
    if (points.length < 2) return;

    const ctx = target.context;
    const chart = (this._primitive as any)._chart;
    const series = (this._primitive as any)._series;
    if (!chart || !series) return;

    // Get coordinates
    const x1 = chart.timeScale().timeToCoordinate(points[0].time);
    const y1 = series.priceToCoordinate(points[0].price);
    const x2 = chart.timeScale().timeToCoordinate(points[1].time);
    const y2 = series.priceToCoordinate(points[1].price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) return;

    const options = (this._primitive as any)._options;
    const isHovered = (this._primitive as any)._isHovered;

    // Draw line
    ctx.save();
    ctx.strokeStyle = isHovered ? '#22c55e' : options.color;
    ctx.lineWidth = isHovered ? options.lineWidth + 1 : options.lineWidth;
    
    if (options.lineStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    } else if (options.lineStyle === 'dotted') {
      ctx.setLineDash([2, 3]);
    }

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    // Draw handles if enabled
    if (options.showHandles) {
      ctx.setLineDash([]);
      ctx.fillStyle = isHovered ? '#22c55e' : options.color;
      
      // Start handle
      ctx.beginPath();
      ctx.arc(x1, y1, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      // End handle
      ctx.beginPath();
      ctx.arc(x2, y2, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    ctx.restore();
  }
}

export class TrendlinePrimitive extends BaseDrawingPrimitive {
  constructor(points: DrawingPoint[], options: DrawingOptions = {}) {
    super(points, options);
    this._paneViews = [new TrendlinePaneView(this)];
  }
}

// ============================================================================
// Horizontal Line Primitive
// ============================================================================

class HorizontalLinePaneView {
  private _primitive: HorizontalLinePrimitive;

  constructor(primitive: HorizontalLinePrimitive) {
    this._primitive = primitive;
  }

  renderer() {
    return new HorizontalLineRenderer(this._primitive);
  }

  update() {}
}

class HorizontalLineRenderer {
  private _primitive: HorizontalLinePrimitive;

  constructor(primitive: HorizontalLinePrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    const points = this._primitive.getPoints();
    if (points.length === 0) return;

    const ctx = target.context;
    const series = (this._primitive as any)._series;
    if (!series) return;

    const y = series.priceToCoordinate(points[0].price);
    if (y === null) return;

    const options = (this._primitive as any)._options;
    const isHovered = (this._primitive as any)._isHovered;

    ctx.save();
    ctx.strokeStyle = isHovered ? '#22c55e' : options.color;
    ctx.lineWidth = isHovered ? options.lineWidth + 1 : options.lineWidth;

    if (options.lineStyle === 'dashed') {
      ctx.setLineDash([5, 5]);
    }

    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(target.mediaSize.width, y);
    ctx.stroke();

    // Draw price label
    ctx.setLineDash([]);
    ctx.fillStyle = options.color;
    ctx.fillRect(target.mediaSize.width - 80, y - 12, 75, 24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px Arial';
    ctx.textAlign = 'right';
    ctx.fillText(points[0].price.toFixed(5), target.mediaSize.width - 5, y + 4);

    ctx.restore();
  }
}

export class HorizontalLinePrimitive extends BaseDrawingPrimitive {
  constructor(points: DrawingPoint[], options: DrawingOptions = {}) {
    super(points, options);
    this._paneViews = [new HorizontalLinePaneView(this)];
  }
}

// ============================================================================
// Rectangle Primitive
// ============================================================================

class RectanglePaneView {
  private _primitive: RectanglePrimitive;

  constructor(primitive: RectanglePrimitive) {
    this._primitive = primitive;
  }

  renderer() {
    return new RectangleRenderer(this._primitive);
  }

  update() {}
}

class RectangleRenderer {
  private _primitive: RectanglePrimitive;

  constructor(primitive: RectanglePrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    const points = this._primitive.getPoints();
    if (points.length < 2) return;

    const ctx = target.context;
    const chart = (this._primitive as any)._chart;
    const series = (this._primitive as any)._series;
    if (!chart || !series) return;

    const x1 = chart.timeScale().timeToCoordinate(points[0].time);
    const y1 = series.priceToCoordinate(points[0].price);
    const x2 = chart.timeScale().timeToCoordinate(points[1].time);
    const y2 = series.priceToCoordinate(points[1].price);

    if (x1 === null || y1 === null || x2 === null || y2 === null) return;

    const options = (this._primitive as any)._options;
    const isHovered = (this._primitive as any)._isHovered;

    ctx.save();
    ctx.strokeStyle = isHovered ? '#22c55e' : options.color;
    ctx.lineWidth = isHovered ? options.lineWidth + 1 : options.lineWidth;
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

    // Draw handles
    if (options.showHandles) {
      ctx.fillStyle = isHovered ? '#22c55e' : options.color;
      ctx.beginPath();
      ctx.arc(x1, y1, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(x2, y2, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }
}

export class RectanglePrimitive extends BaseDrawingPrimitive {
  constructor(points: DrawingPoint[], options: DrawingOptions = {}) {
    super(points, options);
    this._paneViews = [new RectanglePaneView(this)];
  }
}

// ============================================================================
// Fibonacci Retracement Primitive
// ============================================================================

class FibonacciPaneView {
  private _primitive: FibonacciPrimitive;

  constructor(primitive: FibonacciPrimitive) {
    this._primitive = primitive;
  }

  renderer() {
    return new FibonacciRenderer(this._primitive);
  }

  update() {}
}

class FibonacciRenderer {
  private _primitive: FibonacciPrimitive;
  private _levels = [
    { level: 0, label: '0.0%', color: '#2196F3' },
    { level: 0.236, label: '23.6%', color: '#FFC107' },
    { level: 0.382, label: '38.2%', color: '#FFC107' },
    { level: 0.5, label: '50.0%', color: '#FFC107' },
    { level: 0.618, label: '61.8%', color: '#FFC107' },
    { level: 0.786, label: '78.6%', color: '#FFC107' },
    { level: 1, label: '100.0%', color: '#2196F3' },
  ];

  constructor(primitive: FibonacciPrimitive) {
    this._primitive = primitive;
  }

  draw(target: any) {
    const points = this._primitive.getPoints();
    if (points.length < 2) return;

    const ctx = target.context;
    const series = (this._primitive as any)._series;
    if (!series) return;

    const y1 = series.priceToCoordinate(points[0].price);
    const y2 = series.priceToCoordinate(points[1].price);

    if (y1 === null || y2 === null) return;

    const options = (this._primitive as any)._options;

    ctx.save();

    // Draw Fibonacci levels
    this._levels.forEach(fib => {
      const y = y1 + (y2 - y1) * fib.level;
      const isMainLevel = fib.level === 0 || fib.level === 1;

      ctx.strokeStyle = fib.color;
      ctx.lineWidth = isMainLevel ? 2 : 1;
      ctx.setLineDash(isMainLevel ? [] : [5, 3]);

      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(target.mediaSize.width, y);
      ctx.stroke();

      // Draw label
      ctx.fillStyle = fib.color;
      ctx.font = 'bold 12px Arial';
      ctx.textAlign = 'left';
      ctx.fillText(fib.label, 10, y - 5);

      // Draw price
      const price = series.coordinateToPrice(y);
      if (price !== null) {
        ctx.textAlign = 'right';
        ctx.fillText(price.toFixed(5), target.mediaSize.width - 10, y - 5);
      }
    });

    ctx.restore();
  }
}

export class FibonacciPrimitive extends BaseDrawingPrimitive {
  constructor(points: DrawingPoint[], options: DrawingOptions = {}) {
    super(points, options);
    this._paneViews = [new FibonacciPaneView(this)];
  }
}

// ============================================================================
// Drawing Manager - Handles all drawing interactions
// ============================================================================

export class DrawingManager {
  private _chart: any;
  private _series: any;
  private _primitives: Map<string, BaseDrawingPrimitive> = new Map();
  private _activeTool: string | null = null;
  private _tempPoints: DrawingPoint[] = [];
  private _nextId: number = 1;

  constructor(chart: any, series: any) {
    this._chart = chart;
    this._series = series;
  }

  // Set active drawing tool
  setActiveTool(tool: string | null): void {
    this._activeTool = tool;
    this._tempPoints = [];
  }

  // Add a point during drawing
  addPoint(time: Time, price: number): boolean {
    if (!this._activeTool) return false;

    this._tempPoints.push({ time, price });

    // Check if drawing is complete
    const requiredPoints = this._getRequiredPoints(this._activeTool);
    if (this._tempPoints.length >= requiredPoints) {
      this._completeDraw();
      return true;
    }

    return false;
  }

  // Complete current drawing
  private _completeDraw(): void {
    if (!this._activeTool || this._tempPoints.length === 0) return;

    const id = `drawing_${this._nextId++}`;
    let primitive: BaseDrawingPrimitive;

    switch (this._activeTool) {
      case 'trendline':
        primitive = new TrendlinePrimitive(this._tempPoints);
        break;
      case 'horizontal':
        primitive = new HorizontalLinePrimitive([this._tempPoints[0]]);
        break;
      case 'rectangle':
        primitive = new RectanglePrimitive(this._tempPoints);
        break;
      case 'fibonacci':
        primitive = new FibonacciPrimitive(this._tempPoints);
        break;
      default:
        return;
    }

    this._series.attachPrimitive(primitive);
    this._primitives.set(id, primitive);

    // Reset
    this._tempPoints = [];
    this._activeTool = null;
  }

  // Remove a drawing
  removeDrawing(id: string): void {
    const primitive = this._primitives.get(id);
    if (primitive) {
      this._series.detachPrimitive(primitive);
      this._primitives.delete(id);
    }
  }

  // Clear all drawings
  clearAll(): void {
    this._primitives.forEach(primitive => {
      this._series.detachPrimitive(primitive);
    });
    this._primitives.clear();
  }

  private _getRequiredPoints(tool: string): number {
    switch (tool) {
      case 'horizontal':
      case 'vertical':
        return 1;
      case 'trendline':
      case 'rectangle':
      case 'fibonacci':
        return 2;
      default:
        return 2;
    }
  }
}
