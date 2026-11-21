import { useRef, useState } from 'react';
import { ArrowLeft, Eraser } from 'lucide-react';

const penColors = [
  { name: 'Forest green', value: '#17634f' },
  { name: 'Black', value: '#202124' },
  { name: 'Blue', value: '#2878c8' },
  { name: 'Red', value: '#d34a4a' },
  { name: 'Purple', value: '#8055b8' },
  { name: 'Orange', value: '#df8625' }
];

export function SketchPad({ onSave }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);
  const [penColor, setPenColor] = useState(penColors[0].value);
  const [penSize, setPenSize] = useState(4);

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
    context.strokeStyle = penColor;
    context.lineWidth = penSize * (canvas.width / canvas.getBoundingClientRect().width);
    context.lineCap = 'round';
    context.lineJoin = 'round';
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
    <main className="notes-sketch-page">
      <header className="notes-sketch-header">
        <button
          type="button"
          className="back-button"
          onClick={() => onSave(canvasRef.current.toDataURL('image/png'))}
          aria-label="Back to note and save sketch"
        >
          <ArrowLeft size={22} />
        </button>
        <h1>Sketch</h1>
        <button type="button" className="notes-tool-icon" onClick={clear} aria-label="Clear sketch" title="Clear sketch">
          <Eraser size={18} />
        </button>
      </header>
      <div className="notes-sketch-tools">
        <div className="notes-sketch-colors" role="group" aria-label="Pen color">
          {penColors.map((color) => (
            <button
              type="button"
              key={color.value}
              className={`notes-sketch-color ${penColor === color.value ? 'selected' : ''}`}
              style={{ backgroundColor: color.value }}
              aria-label={`${color.name} pen`}
              aria-pressed={penColor === color.value}
              title={color.name}
              onClick={() => setPenColor(color.value)}
            />
          ))}
        </div>
        <label className="notes-sketch-size-control">
          <span>Pen size</span>
          <input
            type="range"
            min="1"
            max="16"
            value={penSize}
            onChange={(event) => setPenSize(Number(event.target.value))}
            aria-label="Pen size"
          />
          <output>{penSize}px</output>
        </label>
      </div>
      <canvas
        ref={canvasRef}
        className="notes-sketch-canvas"
        width={1200}
        height={1000}
        onPointerDown={startDrawing}
        onPointerMove={draw}
        onPointerUp={finishDrawing}
        onPointerCancel={finishDrawing}
        aria-label="Draw a sketch"
      />
      <p className="notes-sketch-hint">Your sketch saves when you return to the note.</p>
    </main>
  );
}
