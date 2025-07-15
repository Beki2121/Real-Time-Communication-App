import { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, Navigate } from 'react-router-dom';
import Login from './components/Login.jsx';
import Register from './components/Register.jsx';
import VideoCall from './components/VideoCall.jsx';
import Whiteboard from './components/Whiteboard.jsx';
import FileUpload from './components/FileUpload.jsx';
import Chat from './components/Chat.jsx';
import RoomSelect from './components/RoomSelect.jsx';
import './App.css';

function App() {
  const [user, setUser] = useState(() => {
    const token = localStorage.getItem('token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      return { id: payload.id, username: payload.username, full_name: payload.full_name, email: payload.email };
    } catch {
      return null;
    }
  });
  const [showRegister, setShowRegister] = useState(false);
  const [roomId, setRoomId] = useState(null);

  const handleLogin = (user) => setUser(user);
  const handleLogout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setRoomId(null);
  };
  const handleRegister = async ({ email, password }) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (res.ok) {
      localStorage.setItem('token', data.token);
      setUser(data.user);
    }
  };

  if (!user) {
    return (
      <div className="auth-container">
        {showRegister ? (
          <>
            <Register onRegister={handleRegister} />
            <p>Already have an account? <button onClick={() => setShowRegister(false)}>Login</button></p>
          </>
        ) : (
          <>
            <Login onLogin={handleLogin} />
            <p>Don&apos;t have an account? <button onClick={() => setShowRegister(true)}>Register</button></p>
          </>
        )}
      </div>
    );
  }

  if (!roomId) {
    return <RoomSelect onJoin={setRoomId} />;
  }

  const handleMeetingEnd = () => setRoomId(null);

  return (
    <Router>
      <div className="main-app">
        <nav>
          <span>Welcome, {user.full_name || user.username}! Room: <b>{roomId}</b></span>
          <button onClick={handleLogout} style={{ marginLeft: 16 }}>Logout</button>
          <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', margin: 0, padding: 0 }}>
            <li><Link to="/video">Video Call</Link></li>
            <li><Link to="/whiteboard">Whiteboard</Link></li>
            <li><Link to="/files">File Upload</Link></li>
            <li><Link to="/chat">Chat</Link></li>
          </ul>
        </nav>
        <Routes>
          <Route path="/video" element={<VideoCall roomId={roomId} user={user} onLeave={handleMeetingEnd} />} />
          <Route path="/whiteboard" element={<Whiteboard roomId={roomId} />} />
          <Route path="/files" element={<FileUpload roomId={roomId} />} />
          <Route path="/chat" element={<Chat roomId={roomId} user={user} />} />
          <Route path="*" element={<Navigate to="/video" />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
