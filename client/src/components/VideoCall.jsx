import React, { useRef, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import './VideoCall.css';

const SOCKET_URL = 'http://localhost:5000';
const EMOJIS = ['👍', '👏', '😂', '😮', '❤️', '🙌'];

export default function VideoCall({ roomId, user, onLeave }) {
  const localVideo = useRef();
  const remoteVideo = useRef();
  const [socket, setSocket] = useState(null);
  const [peer, setPeer] = useState(null);
  const [joined, setJoined] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [audioMuted, setAudioMuted] = useState(false);
  const [videoMuted, setVideoMuted] = useState(false);
  const [hostId, setHostId] = useState(null);
  const [isKicked, setIsKicked] = useState(false);
  const [isMutedByHost, setIsMutedByHost] = useState(false);
  const [meetingEnded, setMeetingEnded] = useState(false);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [waitingList, setWaitingList] = useState([]);
  const [hands, setHands] = useState({});
  const [reactions, setReactions] = useState({});
  const [currentSharer, setCurrentSharer] = useState(null); // socketId of current screen sharer
  const cameraStreamRef = useRef(null);

  useEffect(() => {
    if (!roomId) return;
    const s = io(SOCKET_URL, { transports: ['websocket'] });
    setSocket(s);
    return () => s.disconnect();
  }, [roomId]);

  useEffect(() => {
    if (!socket || !roomId) return;
    let pc;
    let local;
    let admitted = false;
    let sharing = false;

    const joinRoom = async () => {
      socket.emit('join-room', { roomId, userId: socket.id, fullName: user.full_name });
    };

    socket.on('waiting-room', () => {
      setWaitingRoom(true);
    });
    socket.on('admitted', async () => {
      setWaitingRoom(false);
      admitted = true;
      try {
        local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        setLocalStream(local);
        if (localVideo.current) {
          localVideo.current.srcObject = local;
        }
        cameraStreamRef.current = local;
        pc = new RTCPeerConnection();
        setPeer(pc);
        local.getTracks().forEach(track => pc.addTrack(track, local));
        pc.onicecandidate = (e) => {
          if (e.candidate) {
            socket.emit('signal', { roomId, candidate: e.candidate });
          }
        };
        pc.ontrack = (e) => {
          if (remoteVideo.current) {
            remoteVideo.current.srcObject = e.streams[0];
          }
        };
        setJoined(true);
      } catch (err) {
        alert('Could not start video: ' + err.message);
        setJoined(false);
      }
    });

    // For host, join directly
    socket.on('participants', (list) => {
      setParticipants(list.map(p => JSON.parse(p)));
    });
    socket.on('host', (hostSocketId) => {
      setHostId(hostSocketId);
    });
    socket.on('waiting-list', (list) => {
      setWaitingList(list.map(p => JSON.parse(p)));
    });
    socket.on('hand-raised', ({ socketId }) => {
      setHands(h => ({ ...h, [socketId]: true }));
    });
    socket.on('hand-lowered', ({ socketId }) => {
      setHands(h => {
        const copy = { ...h };
        delete copy[socketId];
        return copy;
      });
    });
    socket.on('reaction', ({ socketId, emoji }) => {
      setReactions(r => ({ ...r, [socketId]: emoji }));
      setTimeout(() => {
        setReactions(r => {
          const copy = { ...r };
          delete copy[socketId];
          return copy;
        });
      }, 2500);
    });
    socket.on('screen-share-started', ({ socketId }) => {
      setCurrentSharer(socketId);
    });
    socket.on('screen-share-stopped', ({ socketId }) => {
      setCurrentSharer(null);
      if (socket.id === socketId) {
        setScreenSharing(false);
        if (localVideo.current && cameraStreamRef.current) {
          localVideo.current.srcObject = cameraStreamRef.current;
        }
      }
    });
    socket.on('force-stop-screen-share', () => {
      setScreenSharing(false);
      if (localVideo.current && cameraStreamRef.current) {
        localVideo.current.srcObject = cameraStreamRef.current;
      }
    });
    socket.on('kicked', () => {
      setIsKicked(true);
      setTimeout(() => {
        if (onLeave) onLeave();
      }, 2000);
    });
    socket.on('muted-by-host', () => {
      setIsMutedByHost(true);
      setAudioMuted(true);
      if (localStream) {
        localStream.getAudioTracks().forEach(track => (track.enabled = false));
      }
    });
    socket.on('meeting-ended', () => {
      setMeetingEnded(true);
      setTimeout(() => {
        if (onLeave) onLeave();
      }, 2000);
    });

    socket.on('signal', async (data) => {
      if (!admitted && !waitingRoom) return;
      if (data.offer) {
        await pc.setRemoteDescription(new window.RTCSessionDescription(data.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', { roomId, answer });
      } else if (data.answer) {
        await pc.setRemoteDescription(new window.RTCSessionDescription(data.answer));
      } else if (data.candidate) {
        try {
          await pc.addIceCandidate(new window.RTCIceCandidate(data.candidate));
        } catch {}
      }
    });

    joinRoom();

    return () => {
      if (local) local.getTracks().forEach(t => t.stop());
      if (pc) pc.close();
      socket.off('user-joined');
      socket.off('signal');
      socket.off('participants');
      socket.off('host');
      socket.off('kicked');
      socket.off('muted-by-host');
      socket.off('meeting-ended');
      socket.off('waiting-room');
      socket.off('admitted');
      socket.off('waiting-list');
      socket.off('hand-raised');
      socket.off('hand-lowered');
      socket.off('reaction');
      socket.off('screen-share-started');
      socket.off('screen-share-stopped');
      socket.off('force-stop-screen-share');
    };
  }, [socket, roomId, localStream, onLeave, waitingRoom, user]);

  // Mute/unmute logic
  const handleToggleAudio = () => {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !track.enabled;
      setAudioMuted(!track.enabled);
    });
    setIsMutedByHost(false);
  };
  const handleToggleVideo = () => {
    if (!localStream) return;
    localStream.getVideoTracks().forEach(track => {
      track.enabled = !track.enabled;
      setVideoMuted(!track.enabled);
    });
  };

  // Host controls
  const isHost = socket && hostId === socket.id;
  const handleKick = (targetSocketId) => {
    if (socket) socket.emit('kick-user', { roomId, targetSocketId });
  };
  const handleMute = (targetSocketId) => {
    if (socket) socket.emit('mute-user', { roomId, targetSocketId });
  };
  const handleEndMeeting = () => {
    if (socket) socket.emit('end-meeting', { roomId });
  };
  const handleAdmit = (targetSocketId, userId, fullName) => {
    if (socket) socket.emit('admit-user', { roomId, targetSocketId, userId, fullName });
  };
  const handleHostStopScreenShare = (targetSocketId) => {
    if (socket) socket.emit('host-stop-screen-share', { roomId, targetSocketId });
  };

  // Raise hand / reactions
  const isHandRaised = !!hands[socket?.id];
  const handleRaiseHand = () => {
    if (socket) socket.emit(isHandRaised ? 'lower-hand' : 'raise-hand', { roomId, userId: socket.id });
  };
  const handleReaction = (emoji) => {
    if (socket) socket.emit('reaction', { roomId, userId: socket.id, emoji });
  };

  // Screen sharing logic
  const handleShareScreen = async () => {
    if (!peer) return;
    if (currentSharer && currentSharer !== socket.id && !isHost) return; // Only one at a time, unless host
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      setScreenSharing(true);
      const screenTrack = screenStream.getVideoTracks()[0];
      const sender = peer.getSenders().find(s => s.track && s.track.kind === 'video');
      if (sender) sender.replaceTrack(screenTrack);
      localVideo.current.srcObject = screenStream;
      socket.emit('start-screen-share', { roomId });
      screenTrack.onended = () => {
        if (cameraStreamRef.current) {
          const camTrack = cameraStreamRef.current.getVideoTracks()[0];
          if (sender) sender.replaceTrack(camTrack);
          localVideo.current.srcObject = cameraStreamRef.current;
        }
        setScreenSharing(false);
        socket.emit('stop-screen-share', { roomId });
      };
    } catch (err) {
      setScreenSharing(false);
    }
  };
  const handleStopScreenShare = () => {
    if (screenSharing && socket) {
      setScreenSharing(false);
      if (localVideo.current && cameraStreamRef.current) {
        localVideo.current.srcObject = cameraStreamRef.current;
      }
      socket.emit('stop-screen-share', { roomId });
    }
  };

  // Leave meeting logic
  const handleLeave = () => {
    if (localStream) localStream.getTracks().forEach(t => t.stop());
    if (peer) peer.close();
    if (socket) {
      socket.emit('leave-room', { roomId, userId: socket.id });
      socket.disconnect();
    }
    setJoined(false);
    if (onLeave) onLeave();
  };

  if (isKicked) {
    return <div className="video-call-container"><h2>You have been removed by the host.</h2></div>;
  }
  if (meetingEnded) {
    return <div className="video-call-container"><h2>The meeting has ended.</h2></div>;
  }
  if (waitingRoom) {
    return <div className="video-call-container"><h2>Waiting for host to admit you...</h2></div>;
  }

  const sharerName = participants.find(p => p.socketId === currentSharer)?.fullName || (currentSharer === socket?.id ? 'You' : null);

  return (
    <div className="video-call-container">
      <h2>Video Call Demo</h2>
      {currentSharer && (
        <div style={{ textAlign: 'center', marginBottom: 8 }}>
          <b>Screen sharing: {sharerName}</b>
          {isHost && currentSharer !== socket?.id && (
            <button className="screen-share-btn" style={{ background: '#d32f2f', marginLeft: 8 }} onClick={() => handleHostStopScreenShare(currentSharer)}>
              Stop Screen Share
            </button>
          )}
          {currentSharer === socket?.id && screenSharing && (
            <button className="screen-share-btn" style={{ background: '#d32f2f', marginLeft: 8 }} onClick={handleStopScreenShare}>
              Stop Sharing
            </button>
          )}
        </div>
      )}
      <div className="video-row">
        <div className="video-box">
          <h4>Local Video {screenSharing && '(Screen Sharing)'}</h4>
          <video ref={localVideo} autoPlay muted playsInline />
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <button className="screen-share-btn" onClick={handleShareScreen} disabled={screenSharing || (!!currentSharer && currentSharer !== socket?.id && !isHost)}>
              {screenSharing ? 'Sharing Screen...' : 'Share Screen'}
            </button>
            <button className="screen-share-btn" style={{ background: audioMuted ? '#d32f2f' : '#007bff' }} onClick={handleToggleAudio}>
              {audioMuted ? 'Unmute Audio' : 'Mute Audio'}
            </button>
            <button className="screen-share-btn" style={{ background: videoMuted ? '#d32f2f' : '#007bff' }} onClick={handleToggleVideo}>
              {videoMuted ? 'Unmute Video' : 'Mute Video'}
            </button>
            <button className="screen-share-btn" style={{ background: isHandRaised ? '#ff9800' : '#007bff' }} onClick={handleRaiseHand}>
              {isHandRaised ? 'Lower Hand' : 'Raise Hand'}
            </button>
            {EMOJIS.map((emoji) => (
              <button key={emoji} className="screen-share-btn" style={{ fontSize: '1.2rem', padding: '0.2rem 0.5rem' }} onClick={() => handleReaction(emoji)}>{emoji}</button>
            ))}
          </div>
          {isMutedByHost && <div style={{ color: '#d32f2f', marginTop: 8 }}>You have been muted by the host.</div>}
        </div>
        <div className="video-box">
          <h4>Remote Video</h4>
          <video ref={remoteVideo} autoPlay playsInline />
        </div>
      </div>
      <div style={{ textAlign: 'center', marginTop: '1rem' }}>
        <button className="login-btn" style={{ background: '#d32f2f' }} onClick={handleLeave}>
          End Meeting
        </button>
        {isHost && (
          <button className="login-btn" style={{ background: '#222', marginLeft: 8 }} onClick={handleEndMeeting}>
            End Meeting for All
          </button>
        )}
      </div>
      {isHost && waitingList.length > 0 && (
        <div className="waiting-list" style={{ marginTop: '2rem' }}>
          <h4>Waiting Room ({waitingList.length})</h4>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {waitingList.map((p, idx) => (
              <li key={p.socketId + '-' + (p.userId || idx)} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {p.fullName || p.userId}
                <button className="screen-share-btn" style={{ background: '#28a745', fontSize: '0.9rem', padding: '0.2rem 0.5rem' }} onClick={() => handleAdmit(p.socketId, p.userId, p.fullName)}>Admit</button>
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="participant-list" style={{ marginTop: '2rem' }}>
        <h4>Participants ({participants.length})</h4>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {participants.map((p, idx) => (
            <li key={p.socketId + '-' + (p.userId || idx)} style={{ fontWeight: p.socketId === socket?.id ? 'bold' : 'normal', display: 'flex', alignItems: 'center', gap: 8 }}>
              {p.socketId === socket?.id ? 'You' : (p.fullName || p.userId)}
              {p.isHost && <span style={{ color: '#ff9800', fontWeight: 'bold', marginLeft: 4 }}>(Host)</span>}
              {hands[p.socketId] && <span title="Hand Raised" style={{ fontSize: '1.2rem', marginLeft: 4 }}>✋</span>}
              {reactions[p.socketId] && <span title="Reaction" style={{ fontSize: '1.2rem', marginLeft: 4 }}>{reactions[p.socketId]}</span>}
              {isHost && p.socketId !== socket?.id && (
                <>
                  <button className="screen-share-btn" style={{ background: '#d32f2f', fontSize: '0.9rem', padding: '0.2rem 0.5rem' }} onClick={() => handleKick(p.socketId)}>Kick</button>
                  <button className="screen-share-btn" style={{ background: '#ff9800', fontSize: '0.9rem', padding: '0.2rem 0.5rem' }} onClick={() => handleMute(p.socketId)}>Mute</button>
                  {currentSharer === p.socketId && (
                    <button className="screen-share-btn" style={{ background: '#d32f2f', fontSize: '0.9rem', padding: '0.2rem 0.5rem' }} onClick={() => handleHostStopScreenShare(p.socketId)}>Stop Screen Share</button>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
      {!joined && <p>Joining room...</p>}
    </div>
  );
} 