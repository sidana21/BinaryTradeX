import { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';

export interface Point {
  x: number;
  y: number;
  time?: number;
  price?: number;
}

export interface DrawingShape {
  id: string;
  type: 'trendline' | 'horizontal' | 'vertical' | 'rectangle' | 'fibonacci';
  points: Point[];
  color: string;
  lineWidth: number;
  selected?: boolean;
}

interface InteractiveDrawingToolsProps {
  containerRef: React.RefObject<HTMLDivElement>;
  chartWidth: number;
  chartHeight: number;
  activeDrawingTool: string | null;
  onDrawingComplete: () => void;
  timeToX: (time: number) => number | null;
  priceToY: (price: number) => number | null;
  xToTime: (x: number) => number | null;
  yToPrice: (y: number) => number | null;
}

export function InteractiveDrawingTools({
  containerRef,
  chartWidth,
  chartHeight,
  activeDrawingTool,
  onDrawingComplete,
  timeToX,
  priceToY,
  xToTime,
  yToPrice,
}: InteractiveDrawingToolsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shapes, setShapes] = useState<DrawingShape[]>([]);
  const [currentShape, setCurrentShape] = useState<DrawingShape | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [selectedShape, setSelectedShape] = useState<string | null>(null);
  const [dragHandle, setDragHandle] = useState<{
    shapeId: string;
    pointIndex: number;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    shapeId: string;
  } | null>(null);
  const lastClickTimeRef = useRef<number>(0);

  // رسم جميع الأشكال
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, chartWidth, chartHeight);

    // رسم جميع الأشكال المحفوظة
    [...shapes, ...(currentShape ? [currentShape] : [])].forEach((shape) => {
      ctx.strokeStyle = shape.color;
      ctx.lineWidth = shape.lineWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (shape.type === 'trendline' && shape.points.length >= 2) {
        // خط الاتجاه
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, shape.points[0].y);
        ctx.lineTo(shape.points[1].x, shape.points[1].y);
        ctx.stroke();

        // رسم Handles إذا كان الشكل محدداً
        if (shape.selected) {
          shape.points.forEach((point) => {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
      } else if (shape.type === 'horizontal' && shape.points.length >= 1) {
        // خط أفقي
        ctx.beginPath();
        ctx.moveTo(0, shape.points[0].y);
        ctx.lineTo(chartWidth, shape.points[0].y);
        ctx.stroke();

        if (shape.selected) {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(chartWidth / 2, shape.points[0].y, 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (shape.type === 'vertical' && shape.points.length >= 1) {
        // خط عمودي
        ctx.beginPath();
        ctx.moveTo(shape.points[0].x, 0);
        ctx.lineTo(shape.points[0].x, chartHeight);
        ctx.stroke();

        if (shape.selected) {
          ctx.fillStyle = '#FFD700';
          ctx.beginPath();
          ctx.arc(shape.points[0].x, chartHeight / 2, 6, 0, 2 * Math.PI);
          ctx.fill();
          ctx.strokeStyle = '#FFFFFF';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      } else if (shape.type === 'rectangle' && shape.points.length >= 2) {
        // مستطيل
        const width = shape.points[1].x - shape.points[0].x;
        const height = shape.points[1].y - shape.points[0].y;
        ctx.strokeRect(shape.points[0].x, shape.points[0].y, width, height);

        if (shape.selected) {
          shape.points.forEach((point) => {
            ctx.fillStyle = '#FFD700';
            ctx.beginPath();
            ctx.arc(point.x, point.y, 6, 0, 2 * Math.PI);
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
          });
        }
      }
    });
  };

  // التحقق من النقر على Handle
  const isPointNearHandle = (x: number, y: number, handle: Point): boolean => {
    const distance = Math.sqrt(
      Math.pow(x - handle.x, 2) + Math.pow(y - handle.y, 2)
    );
    return distance < 10;
  };

  // التحقق من النقر على خط
  const isPointNearLine = (
    x: number,
    y: number,
    p1: Point,
    p2: Point
  ): boolean => {
    const distance =
      Math.abs(
        (p2.y - p1.y) * x - (p2.x - p1.x) * y + p2.x * p1.y - p2.y * p1.x
      ) / Math.sqrt(Math.pow(p2.y - p1.y, 2) + Math.pow(p2.x - p1.x, 2));
    return distance < 10;
  };

  // معالجة بداية الرسم أو السحب
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // التحقق من النقر على Handle لشكل محدد
    if (selectedShape) {
      const shape = shapes.find((s) => s.id === selectedShape);
      if (shape) {
        for (let i = 0; i < shape.points.length; i++) {
          if (isPointNearHandle(x, y, shape.points[i])) {
            setDragHandle({ shapeId: shape.id, pointIndex: i });
            return;
          }
        }
      }
    }

    // التحقق من النقر على خط موجود
    for (const shape of shapes) {
      if (shape.type === 'trendline' && shape.points.length >= 2) {
        if (isPointNearLine(x, y, shape.points[0], shape.points[1])) {
          handleShapeClick(shape.id);
          return;
        }
      } else if (shape.type === 'horizontal' && shape.points.length >= 1) {
        if (Math.abs(y - shape.points[0].y) < 10) {
          handleShapeClick(shape.id);
          return;
        }
      } else if (shape.type === 'vertical' && shape.points.length >= 1) {
        if (Math.abs(x - shape.points[0].x) < 10) {
          handleShapeClick(shape.id);
          return;
        }
      }
    }

    // إذا كانت هناك أداة رسم نشطة، ابدأ الرسم
    if (activeDrawingTool) {
      const time = xToTime(x);
      const price = yToPrice(y);
      
      const newShape: DrawingShape = {
        id: `shape-${Date.now()}`,
        type: activeDrawingTool as any,
        points: [{ x, y, time: time || undefined, price: price || undefined }],
        color: '#FFD700',
        lineWidth: 2,
      };
      
      setCurrentShape(newShape);
      setIsDrawing(true);
    }
  };

  // معالجة حركة الماوس
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // سحب Handle
    if (dragHandle) {
      setShapes((prevShapes) =>
        prevShapes.map((shape) => {
          if (shape.id === dragHandle.shapeId) {
            const time = xToTime(x);
            const price = yToPrice(y);
            const newPoints = [...shape.points];
            newPoints[dragHandle.pointIndex] = {
              x,
              y,
              time: time || undefined,
              price: price || undefined,
            };
            return { ...shape, points: newPoints };
          }
          return shape;
        })
      );
      return;
    }

    // الرسم
    if (isDrawing && currentShape) {
      const time = xToTime(x);
      const price = yToPrice(y);
      
      if (
        currentShape.type === 'horizontal' ||
        currentShape.type === 'vertical'
      ) {
        // الخط الأفقي أو العمودي يحتاج نقطة واحدة فقط
        setCurrentShape({
          ...currentShape,
          points: [{ x, y, time: time || undefined, price: price || undefined }],
        });
      } else {
        // خط الاتجاه أو المستطيل
        setCurrentShape({
          ...currentShape,
          points: [
            currentShape.points[0],
            { x, y, time: time || undefined, price: price || undefined },
          ],
        });
      }
    }
  };

  // معالجة إنهاء الرسم أو السحب
  const handleMouseUp = () => {
    if (dragHandle) {
      setDragHandle(null);
      return;
    }

    if (isDrawing && currentShape) {
      if (currentShape.points.length >= 1) {
        setShapes((prev) => [...prev, currentShape]);
        setCurrentShape(null);
        setIsDrawing(false);
        onDrawingComplete();
      }
    }
  };

  // معالجة النقر على شكل
  const handleShapeClick = (shapeId: string) => {
    const now = Date.now();
    const timeSinceLastClick = now - lastClickTimeRef.current;
    lastClickTimeRef.current = now;

    // Double click
    if (timeSinceLastClick < 300) {
      const canvas = canvasRef.current;
      if (!canvas) return;
      
      const shape = shapes.find((s) => s.id === shapeId);
      if (shape && shape.points.length > 0) {
        const rect = canvas.getBoundingClientRect();
        setContextMenu({
          x: shape.points[0].x + rect.left,
          y: shape.points[0].y + rect.top,
          shapeId,
        });
      }
    } else {
      // Single click - تحديد الشكل
      setShapes((prevShapes) =>
        prevShapes.map((shape) => ({
          ...shape,
          selected: shape.id === shapeId,
        }))
      );
      setSelectedShape(shapeId);
    }
  };

  // حذف شكل
  const deleteShape = (shapeId: string) => {
    setShapes((prev) => prev.filter((s) => s.id !== shapeId));
    setSelectedShape(null);
    setContextMenu(null);
  };

  // رسم الأشكال عند التحديث
  useEffect(() => {
    draw();
  }, [shapes, currentShape, chartWidth, chartHeight]);

  return (
    <>
      <canvas
        ref={canvasRef}
        width={chartWidth}
        height={chartHeight}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="absolute top-0 left-0 cursor-crosshair"
        style={{ pointerEvents: 'auto' }}
      />

      {/* Context Menu للحذف */}
      {contextMenu && (
        <div
          className="fixed bg-[#1a2033] border border-gray-700 rounded-lg shadow-xl p-1 z-50"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
          }}
        >
          <button
            onClick={() => deleteShape(contextMenu.shapeId)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-red-500/20 text-red-400 rounded transition-colors w-full text-left"
          >
            <Trash2 className="w-4 h-4" />
            <span className="text-sm">حذف</span>
          </button>
          <button
            onClick={() => setContextMenu(null)}
            className="flex items-center gap-2 px-3 py-2 hover:bg-gray-700 text-gray-300 rounded transition-colors w-full text-left"
          >
            <X className="w-4 h-4" />
            <span className="text-sm">إلغاء</span>
          </button>
        </div>
      )}

      {/* إغلاق Context Menu عند النقر خارجه */}
      {contextMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setContextMenu(null)}
        />
      )}
    </>
  );
}
