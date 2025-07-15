import React, { useRef, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import './FileUpload.css';

const SOCKET_URL = 'http://localhost:5000';
const ROOM_ID = 'default';

export default function FileUpload({ roomId }) {
  const [socket, setSocket] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [receivedFiles, setReceivedFiles] = useState([]);

  useEffect(() => {
    if (!roomId) return;
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(s);
    s.emit('join-room', { roomId, userId: s.id });
    s.on('file-receive', ({ fileName, fileData }) => {
      // Convert base64 back to Blob
      const byteString = atob(fileData);
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab]);
      setReceivedFiles(files => [...files, { fileName, url: URL.createObjectURL(blob) }]);
    });
    return () => s.disconnect();
  }, [roomId]);

  const handleFileChange = (e) => {
    setSelectedFile(e.target.files[0]);
  };

  const handleSend = () => {
    if (!selectedFile || !socket) return;
    const reader = new FileReader();
    reader.onload = () => {
      // Convert ArrayBuffer to base64 for transport
      const base64 = btoa(
        new Uint8Array(reader.result)
          .reduce((data, byte) => data + String.fromCharCode(byte), '')
      );
      socket.emit('file-send', {
        roomId: ROOM_ID,
        fileName: selectedFile.name,
        fileData: base64
      });
    };
    reader.readAsArrayBuffer(selectedFile);
  };

  return (
    <div className="file-upload-container">
      <h2>File Sharing</h2>
      <input type="file" onChange={handleFileChange} />
      <button onClick={handleSend} disabled={!selectedFile}>Send File</button>
      <h4>Received Files</h4>
      <ul>
        {receivedFiles.map((file, idx) => (
          <li key={idx}>
            <a href={file.url} download={file.fileName}>{file.fileName}</a>
          </li>
        ))}
      </ul>
    </div>
  );
} 