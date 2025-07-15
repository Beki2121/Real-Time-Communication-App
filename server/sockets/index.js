import { Server } from 'socket.io';

export default function setupSockets(server) {
  const io = new Server(server, { cors: { origin: '*' } });

  // In-memory participant tracking: { roomId: Set of { socketId, userId, isHost } }
  const participants = {};
  const hosts = {};
  const waiting = {};
  const screenSharer = {}; // { roomId: socketId }

  function broadcastParticipants(roomId) {
    const room = participants[roomId] || new Set();
    io.to(roomId).emit('participants', Array.from(room));
    io.to(roomId).emit('host', hosts[roomId] || null);
  }

  function broadcastWaiting(roomId) {
    const waitList = waiting[roomId] || new Set();
    const hostSocketId = hosts[roomId];
    if (hostSocketId) {
      io.to(hostSocketId).emit('waiting-list', Array.from(waitList));
    }
  }

  io.on('connection', (socket) => {
    socket.on('join-room', ({ roomId, userId, fullName }) => {
      // If not host, add to waiting list
      if (!hosts[roomId]) {
        hosts[roomId] = socket.id;
        participants[roomId] = new Set();
        waiting[roomId] = new Set();
        // Host joins directly
        participants[roomId].add(JSON.stringify({ socketId: socket.id, userId, fullName, isHost: true }));
        socket.join(roomId);
        broadcastParticipants(roomId);
        socket.to(roomId).emit('user-joined', userId);
      } else {
        // Add to waiting list
        if (!waiting[roomId]) waiting[roomId] = new Set();
        waiting[roomId].add(JSON.stringify({ socketId: socket.id, userId, fullName }));
        broadcastWaiting(roomId);
        socket.emit('waiting-room');
      }
    });

    socket.on('admit-user', ({ roomId, targetSocketId, userId, fullName }) => {
      // Only host can admit
      if (hosts[roomId] === socket.id && waiting[roomId]) {
        // Remove from waiting
        let admitted = null;
        waiting[roomId].forEach((p) => {
          const parsed = JSON.parse(p);
          if (parsed.socketId === targetSocketId) {
            admitted = p;
            waiting[roomId].delete(p);
          }
        });
        if (admitted) {
          if (!participants[roomId]) participants[roomId] = new Set();
          participants[roomId].add(JSON.stringify({ socketId: targetSocketId, userId, fullName, isHost: false }));
          io.sockets.sockets.get(targetSocketId)?.join(roomId);
          io.to(targetSocketId).emit('admitted');
          broadcastParticipants(roomId);
          broadcastWaiting(roomId);
        }
      }
    });

    socket.on('leave-room', ({ roomId, userId }) => {
      socket.leave(roomId);
      if (participants[roomId]) {
        participants[roomId].forEach((p) => {
          const parsed = JSON.parse(p);
          if (parsed.socketId === socket.id) participants[roomId].delete(p);
        });
        // If host leaves, assign new host
        if (hosts[roomId] === socket.id) {
          const next = Array.from(participants[roomId])[0];
          if (next) {
            const nextParsed = JSON.parse(next);
            hosts[roomId] = nextParsed.socketId;
            // Update isHost flag
            participants[roomId].delete(next);
            participants[roomId].add(JSON.stringify({ ...nextParsed, isHost: true }));
          } else {
            delete hosts[roomId];
          }
        }
        broadcastParticipants(roomId);
      }
      // Remove from waiting list if present
      if (waiting[roomId]) {
        waiting[roomId].forEach((p) => {
          const parsed = JSON.parse(p);
          if (parsed.socketId === socket.id) waiting[roomId].delete(p);
        });
        broadcastWaiting(roomId);
      }
      // Stop screen share if leaving
      if (screenSharer[roomId] === socket.id) {
        delete screenSharer[roomId];
        io.to(roomId).emit('screen-share-stopped', { socketId: socket.id });
      }
    });

    socket.on('disconnecting', () => {
      for (const roomId of socket.rooms) {
        if (participants[roomId]) {
          participants[roomId].forEach((p) => {
            const parsed = JSON.parse(p);
            if (parsed.socketId === socket.id) participants[roomId].delete(p);
          });
          // If host leaves, assign new host
          if (hosts[roomId] === socket.id) {
            const next = Array.from(participants[roomId])[0];
            if (next) {
              const nextParsed = JSON.parse(next);
              hosts[roomId] = nextParsed.socketId;
              participants[roomId].delete(next);
              participants[roomId].add(JSON.stringify({ ...nextParsed, isHost: true }));
            } else {
              delete hosts[roomId];
            }
          }
          broadcastParticipants(roomId);
        }
        // Remove from waiting list if present
        if (waiting[roomId]) {
          waiting[roomId].forEach((p) => {
            const parsed = JSON.parse(p);
            if (parsed.socketId === socket.id) waiting[roomId].delete(p);
          });
          broadcastWaiting(roomId);
        }
        // Stop screen share if disconnecting
        if (screenSharer[roomId] === socket.id) {
          delete screenSharer[roomId];
          io.to(roomId).emit('screen-share-stopped', { socketId: socket.id });
        }
      }
    });

    // Host controls
    socket.on('kick-user', ({ roomId, targetSocketId }) => {
      if (hosts[roomId] === socket.id) {
        io.to(targetSocketId).emit('kicked');
        io.sockets.sockets.get(targetSocketId)?.leave(roomId);
        // Remove from participants
        if (participants[roomId]) {
          participants[roomId].forEach((p) => {
            const parsed = JSON.parse(p);
            if (parsed.socketId === targetSocketId) participants[roomId].delete(p);
          });
          broadcastParticipants(roomId);
        }
      }
    });

    socket.on('mute-user', ({ roomId, targetSocketId }) => {
      if (hosts[roomId] === socket.id) {
        io.to(targetSocketId).emit('muted-by-host');
      }
    });

    socket.on('end-meeting', ({ roomId }) => {
      if (hosts[roomId] === socket.id) {
        io.to(roomId).emit('meeting-ended');
        // Clean up
        delete participants[roomId];
        delete hosts[roomId];
        delete waiting[roomId];
      }
    });

    // Raise hand / reactions
    socket.on('raise-hand', ({ roomId, userId }) => {
      io.to(roomId).emit('hand-raised', { socketId: socket.id, userId });
    });
    socket.on('lower-hand', ({ roomId, userId }) => {
      io.to(roomId).emit('hand-lowered', { socketId: socket.id, userId });
    });
    socket.on('reaction', ({ roomId, userId, emoji }) => {
      io.to(roomId).emit('reaction', { socketId: socket.id, userId, emoji });
    });

    // Screen sharing
    socket.on('start-screen-share', ({ roomId }) => {
      // Only one sharer at a time
      screenSharer[roomId] = socket.id;
      io.to(roomId).emit('screen-share-started', { socketId: socket.id });
    });
    socket.on('stop-screen-share', ({ roomId }) => {
      if (screenSharer[roomId] === socket.id) {
        delete screenSharer[roomId];
        io.to(roomId).emit('screen-share-stopped', { socketId: socket.id });
      }
    });
    socket.on('host-stop-screen-share', ({ roomId, targetSocketId }) => {
      if (hosts[roomId] === socket.id && screenSharer[roomId] === targetSocketId) {
        io.to(targetSocketId).emit('force-stop-screen-share');
        delete screenSharer[roomId];
        io.to(roomId).emit('screen-share-stopped', { socketId: targetSocketId });
      }
    });

    // Existing events...
    socket.on('signal', (data) => {
      io.to(data.roomId).emit('signal', data);
    });

    socket.on('file-send', ({ roomId, fileName, fileData }) => {
      socket.to(roomId).emit('file-receive', { fileName, fileData });
    });

    socket.on('draw', ({ roomId, from, to }) => {
      socket.to(roomId).emit('draw', { from, to });
    });

    socket.on('chat-message', ({ roomId, text, fullName }) => {
      socket.to(roomId).emit('chat-message', { userId: socket.id, text, fullName });
    });

    // Private message (DM)
    socket.on('private-message', ({ roomId, toSocketId, fromSocketId, text, fullName }) => {
      io.to(toSocketId).emit('private-message', { fromSocketId, text, fullName });
    });
  });
} 