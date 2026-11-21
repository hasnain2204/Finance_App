import { useRef, useState } from 'react';
import { Eraser, Save } from 'lucide-react';

export function SketchPad({ onSave }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  const pointFromEvent = (event) => {
    const canvas = canvasRef.current;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: (event.clientX - bounds.left) * (canvas.width / bounds.width),
      y: (event.clientY - bounds.top) * (canvas.height / bounds.height)
    };
  };

  const startDrawing = (event) => {
    const canvas = canvasRef.current;
    canvas.setPointerCapture(event.pointerId);
    const context = canvas.getContext('2d');
    const { x, y } = pointFromEvent(event);
    context.beginPath();
    context.moveTo(x, y);
    context.strokeStyle = '#17634f';
    context.lineWidth = 3;
    context.lineCap = 'round';
    setDrawing(true);
  };

  const draw = (event) => {
    if (!drawing) return;
    const { x, y } = pointFromEvent(event);
    const context = canvasRef.current.getContext('2d');
    context.lineTo(x, y);
    context.stroke();
  };

  const finishDrawing = () => {
    if (!drawing) return;
    canvasRef.current.getContext('2d').closePath();
    setDrawing(false);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
  };

  return (
    <section className="notes-sketch-panel" aria-label="Freehand sketch">
      <canvas
        ref={canvasRef}
        className="notes-sketch-canvas"
        width={900}
        height={420}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
        aria-label="Draw a sketch"
      />
      <div>
        <button type="button" className="notes-export-button" onClick={clear}><Eraser size={15} /> Clear</button>
        <button
          type="button"
          className="notes-export-button"
          onClick={() => onSave(canvasRef.current.toDataURL('image/png'))}
        >
          <Save size={15} /> Save sketch
        </button>
      </div>
    </section>
  );
}
