import React, { useState, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';
import './Chat.css';

const SOCKET_URL = 'http://localhost:5000';
const EMOJIS = ['👍', '😂', '👏', '😮', '❤️', '🙌'];

export default function Chat({ roomId, user }) {
  const [socket, setSocket] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [participants, setParticipants] = useState([]);
  const [dmTarget, setDmTarget] = useState('');
  const [file, setFile] = useState(null);
  const messagesEndRef = useRef();

  useEffect(() => {
    if (!roomId) return;
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(s);
    s.emit('join-room', { roomId, userId: s.id, fullName: user.full_name });
    s.on('chat-message', ({ userId, text, fullName }) => {
      setMessages(msgs => [...msgs, { userId, text, fullName, type: 'public' }]);
    });
    s.on('private-message', ({ fromSocketId, text, fullName }) => {
      setMessages(msgs => [...msgs, { userId: fromSocketId, text, fullName, type: 'dm' }]);
    });
    s.on('participants', (list) => {
      setParticipants(list.map(p => JSON.parse(p)));
    });
    return () => s.disconnect();
  }, [roomId, user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = (e) => {
    e.preventDefault();
    if ((!input.trim() && !file) || !socket) return;
    if (dmTarget) {
      // DM
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit('private-message', {
            roomId,
            toSocketId: dmTarget,
            fromSocketId: socket.id,
            text: '[file]:' + file.name + ':' + reader.result,
            fullName: user.full_name
          });
          setMessages(msgs => [...msgs, { userId: 'Me → ' + (participants.find(p => p.socketId === dmTarget)?.fullName || dmTarget), text: '[file]:' + file.name + ':' + reader.result, type: 'dm' }]);
        };
        reader.readAsDataURL(file);
      } else {
        socket.emit('private-message', {
          roomId,
          toSocketId: dmTarget,
          fromSocketId: socket.id,
          text: input,
          fullName: user.full_name
        });
        setMessages(msgs => [...msgs, { userId: 'Me → ' + (participants.find(p => p.socketId === dmTarget)?.fullName || dmTarget), text: input, type: 'dm' }]);
      }
    } else {
      // Public
      if (file) {
        const reader = new FileReader();
        reader.onload = () => {
          socket.emit('chat-message', { roomId, text: '[file]:' + file.name + ':' + reader.result, fullName: user.full_name });
          setMessages(msgs => [...msgs, { userId: 'Me', text: '[file]:' + file.name + ':' + reader.result, type: 'public' }]);
        };
        reader.readAsDataURL(file);
      } else {
        socket.emit('chat-message', { roomId, text: input, fullName: user.full_name });
        setMessages(msgs => [...msgs, { userId: 'Me', text: input, type: 'public' }]);
      }
    }
    setInput('');
    setFile(null);
  };

  const handleEmoji = (emoji) => setInput(input + emoji);
  const handleFileChange = (e) => setFile(e.target.files[0]);

  // File preview helper
  const renderMessage = (msg) => {
    if (msg.text.startsWith('[file]:')) {
      const parts = msg.text.split(':');
      const name = parts[1];
      const dataUrl = parts.slice(2).join(':');
      if (dataUrl.startsWith('data:image/')) {
        return <span><b>{name}</b><br /><img src={dataUrl} alt={name} style={{ maxWidth: 120, maxHeight: 80, borderRadius: 4, marginTop: 4 }} /></span>;
      } else {
        return <span><b>{name}</b> <a href={dataUrl} download={name}>Download</a></span>;
      }
    }
    return msg.text;
  };

  return (
    <div className="chat-container">
      <h2>Chat</h2>
      <div className="chat-messages-container">
        <div className="chat-messages">
          {messages.map((msg, idx) => (
            <div key={idx} className="chat-message" style={{ color: msg.type === 'dm' ? '#007bff' : undefined }}>
              <b>{msg.userId === 'Me' || msg.userId.startsWith('Me →') ? msg.userId : (msg.fullName || msg.userId)}:</b> {renderMessage(msg)}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>
      <form onSubmit={handleSend} className="chat-input-form">
        <select value={dmTarget} onChange={e => setDmTarget(e.target.value)} className="chat-input">
          <option value="">Everyone</option>
          {participants.filter(p => p.socketId !== socket?.id).map(p => (
            <option key={p.socketId} value={p.socketId}>{p.fullName || p.userId}</option>
          ))}
        </select>
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder={dmTarget ? "Direct message..." : "Type a message..."}
          className="chat-input"
        />
        <input type="file" onChange={handleFileChange} style={{ marginLeft: 4 }} />
        {EMOJIS.map(emoji => (
          <button key={emoji} type="button" className="chat-send-button" style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem' }} onClick={() => handleEmoji(emoji)}>{emoji}</button>
        ))}
        <button type="submit" className="chat-send-button">Send</button>
      </form>
    </div>
  );
} 