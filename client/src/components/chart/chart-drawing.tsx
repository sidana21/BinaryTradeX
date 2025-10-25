import { useEffect, useRef, useState } from 'react';

export interface DrawingLine {
  id: string;
  type: 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'fibonacci';
  points: { x: number; y: number; time?: number; price?: number }[];
  color: string;
}

interface ChartDrawingProps {
  containerRef: React.RefObject<HTMLDivElement>;
  chartRef: React.RefObject<any>;
  activeTool: string | null;
  onDrawingComplete: () => void;
}

export function ChartDrawing({ containerRef, chartRef, activeTool, onDrawingComplete }: ChartDrawingProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawings, setDrawings] = useState<DrawingLine[]>([]);
  const [currentDrawing, setCurrentDrawing] = useState<DrawingLine | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);

  // Setup canvas
  useEffect(() => {
    if (!canvasRef.current || !containerRef.current) return;

    const canvas = canvasRef.current;
    const container = containerRef.current;

    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;

    const handleResize = () => {
      if (canvasRef.current && containerRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        redrawAll();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle mouse/touch events
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!activeTool || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const newDrawing: DrawingLine = {
      id: Date.now().toString(),
      type: activeTool as any,
      points: [{ x, y }],
      color: '#2196F3'
    };

    setCurrentDrawing(newDrawing);
    setIsDrawing(true);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDrawing || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    // Clear canvas and redraw existing drawings
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    redrawAll();

    // Draw current line being created
    ctx.strokeStyle = currentDrawing.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([]);

    const startPoint = currentDrawing.points[0];

    switch (currentDrawing.type) {
      case 'trendline':
        ctx.beginPath();
        ctx.moveTo(startPoint.x, startPoint.y);
        ctx.lineTo(x, y);
        ctx.stroke();
        break;

      case 'horizontal':
        ctx.beginPath();
        ctx.moveTo(0, startPoint.y);
        ctx.lineTo(canvasRef.current.width, startPoint.y);
        ctx.stroke();
        break;

      case 'vertical':
        ctx.beginPath();
        ctx.moveTo(startPoint.x, 0);
        ctx.lineTo(startPoint.x, canvasRef.current.height);
        ctx.stroke();
        break;

      case 'rectangle':
        ctx.strokeRect(
          startPoint.x,
          startPoint.y,
          x - startPoint.x,
          y - startPoint.y
        );
        break;

      case 'fibonacci':
        // Draw fibonacci levels
        const height = y - startPoint.y;
        const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
        levels.forEach(level => {
          const levelY = startPoint.y + (height * level);
          ctx.beginPath();
          ctx.moveTo(0, levelY);
          ctx.lineTo(canvasRef.current!.width, levelY);
          ctx.strokeStyle = level === 0 || level === 1 ? '#2196F3' : '#FFC107';
          ctx.stroke();
          
          // Draw level text
          ctx.fillStyle = '#FFC107';
          ctx.font = '12px Arial';
          ctx.fillText(`${(level * 100).toFixed(1)}%`, 10, levelY - 5);
        });
        break;
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !currentDrawing || !canvasRef.current) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = 'changedTouches' in e ? e.changedTouches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'changedTouches' in e ? e.changedTouches[0].clientY - rect.top : e.clientY - rect.top;

    const completedDrawing = {
      ...currentDrawing,
      points: [...currentDrawing.points, { x, y }]
    };

    setDrawings([...drawings, completedDrawing]);
    setCurrentDrawing(null);
    setIsDrawing(false);
    onDrawingComplete();
  };

  const redrawAll = () => {
    if (!canvasRef.current) return;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);

    drawings.forEach(drawing => {
      ctx.strokeStyle = drawing.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([]);

      if (drawing.points.length < 2) return;

      const [start, end] = drawing.points;

      switch (drawing.type) {
        case 'trendline':
          ctx.beginPath();
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
          ctx.stroke();
          break;

        case 'horizontal':
          ctx.beginPath();
          ctx.moveTo(0, start.y);
          ctx.lineTo(canvasRef.current!.width, start.y);
          ctx.stroke();
          break;

        case 'vertical':
          ctx.beginPath();
          ctx.moveTo(start.x, 0);
          ctx.lineTo(start.x, canvasRef.current!.height);
          ctx.stroke();
          break;

        case 'rectangle':
          ctx.strokeRect(
            start.x,
            start.y,
            end.x - start.x,
            end.y - start.y
          );
          break;

        case 'fibonacci':
          const height = end.y - start.y;
          const levels = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];
          levels.forEach(level => {
            const levelY = start.y + (height * level);
            ctx.beginPath();
            ctx.moveTo(0, levelY);
            ctx.lineTo(canvasRef.current!.width, levelY);
            ctx.strokeStyle = level === 0 || level === 1 ? '#2196F3' : '#FFC107';
            ctx.stroke();
            
            ctx.fillStyle = '#FFC107';
            ctx.font = '12px Arial';
            ctx.fillText(`${(level * 100).toFixed(1)}%`, 10, levelY - 5);
          });
          break;
      }
    });
  };

  // Redraw when drawings change
  useEffect(() => {
    redrawAll();
  }, [drawings]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-20"
      style={{ 
        pointerEvents: activeTool ? 'auto' : 'none',
        cursor: activeTool ? 'crosshair' : 'default'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onTouchStart={handleMouseDown}
      onTouchMove={handleMouseMove}
      onTouchEnd={handleMouseUp}
    />
  );
}
