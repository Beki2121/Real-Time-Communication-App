import React, { useState } from 'react';
import './RoomSelect.css';

function randomRoomId() {
  return Math.random().toString(36).substring(2, 8);
}

export default function RoomSelect({ onJoin }) {
  const [roomId, setRoomId] = useState('');

  const handleCreate = () => {
    const newRoom = randomRoomId();
    setRoomId(newRoom);
    onJoin(newRoom);
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (roomId.trim()) onJoin(roomId.trim());
  };

  return (
    <div className="room-select-container">
      <h2>Join or Create a Room</h2>
      <form onSubmit={handleJoin}>
        <input
          type="text"
          placeholder="Enter Room ID"
          value={roomId}
          onChange={e => setRoomId(e.target.value)}
          style={{ width: '70%' }}
        />
        <button type="submit">Join Room</button>
      </form>
      <div style={{ marginTop: 16 }}>
        <button onClick={handleCreate}>Create New Room</button>
      </div>
    </div>
  );
} 