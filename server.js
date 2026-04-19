import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });
const rooms = new Map();

console.log('Chat server with nicknames and custom room IDs');

wss.on('connection', (ws) => {
  let currentRoom = null;
  let myNick = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    
    if (msg.type === 'create') {
      let roomId = msg.roomId;
      if (!roomId) {
        roomId = Math.random().toString(36).slice(2, 8);
      } else {
        if (rooms.has(roomId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Room ID already exists' }));
          return;
        }
        if (!/^[a-zA-Z0-9\-_]+$/.test(roomId)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Invalid room ID' }));
          return;
        }
      }
      rooms.set(roomId, { clients: new Set([ws]), nicknames: new Map() });
      currentRoom = roomId;
      myNick = msg.nick || 'Anonymous';
      rooms.get(roomId).nicknames.set(ws, myNick);
      ws.send(JSON.stringify({ type: 'created', roomId, nick: myNick }));
      console.log(`Room ${roomId} created by ${myNick}`);
      
    } else if (msg.type === 'join') {
      const roomId = msg.roomId;
      const room = rooms.get(roomId);
      if (!room) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        return;
      }
      if (room.clients.size >= 2) {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full' }));
        return;
      }
      room.clients.add(ws);
      myNick = msg.nick || 'Anonymous';
      room.nicknames.set(ws, myNick);
      currentRoom = roomId;
      ws.send(JSON.stringify({ type: 'joined', roomId, nick: myNick }));
      
      const other = [...room.clients].find(c => c !== ws);
      if (other && other.readyState === 1) {
        other.send(JSON.stringify({ type: 'peer_joined', nick: myNick }));
        const firstNick = room.nicknames.get(other);
        ws.send(JSON.stringify({ type: 'peer_info', nick: firstNick }));
      }
      console.log(`${myNick} joined ${roomId}`);
      
    } else if (msg.type === 'message') {
      if (!currentRoom) return;
      const room = rooms.get(currentRoom);
      if (!room) return;
      const other = [...room.clients].find(c => c !== ws);
      if (other && other.readyState === 1) {
        other.send(JSON.stringify({
          type: 'message',
          text: msg.text,
          nick: myNick,
          timestamp: Date.now()
        }));
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Peer disconnected' }));
      }
    }
  });
  
  ws.on('close', () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        room.clients.delete(ws);
        room.nicknames.delete(ws);
        if (room.clients.size === 0) {
          rooms.delete(currentRoom);
        } else {
          const remaining = [...room.clients][0];
          if (remaining && remaining.readyState === 1) {
            remaining.send(JSON.stringify({ type: 'peer_left' }));
          }
        }
      }
    }
  });
});
