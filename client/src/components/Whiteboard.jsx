import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './Whiteboard.css';

const SOCKET_URL = 'http://localhost:5000';
const ROOM_ID = 'default';

export default function Whiteboard({ roomId }) {
  const canvasRef = useRef();
  const [socket, setSocket] = useState(null);
  const [drawing, setDrawing] = useState(false);
  const [lastPos, setLastPos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    if (!roomId) return;
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(s);
    s.emit('join-room', { roomId, userId: s.id });
    s.on('draw', ({ from, to }) => {
      const ctx = canvasRef.current.getContext('2d');
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    });
    return () => s.disconnect();
  }, [roomId]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (e.touches ? e.touches[0].clientX : e.clientX) - rect.left,
      y: (e.touches ? e.touches[0].clientY : e.clientY) - rect.top
    };
  };

  const handlePointerDown = (e) => {
    setDrawing(true);
    setLastPos(getPos(e));
  };

  const handlePointerMove = (e) => {
    if (!drawing) return;
    const newPos = getPos(e);
    const ctx = canvasRef.current.getContext('2d');
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lastPos.x, lastPos.y);
    ctx.lineTo(newPos.x, newPos.y);
    ctx.stroke();
    if (socket) {
      socket.emit('draw', { roomId, from: lastPos, to: newPos });
    }
    setLastPos(newPos);
  };

  const handlePointerUp = () => setDrawing(false);

  return (
    <div className="whiteboard-container">
      <h2>Collaborative Whiteboard</h2>
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        style={{ border: '1px solid #888', background: '#fff', touchAction: 'none' }}
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      />
    </div>
  );
} 