import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });
const rooms = new Map();

console.log('Signal server running on port ' + (process.env.PORT || 8080));

wss.on('connection', (ws) => {
  let myRoomId = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    
    if (msg.type === 'create') {
      const roomId = Math.random().toString(36).slice(2, 8);
      rooms.set(roomId, { initiator: ws, joiner: null });
      myRoomId = roomId;
      ws.send(JSON.stringify({ type: 'created', roomId }));
      console.log('Room created:', roomId);
      
    } else if (msg.type === 'join') {
      const room = rooms.get(msg.roomId);
      if (room && !room.joiner) {
        room.joiner = ws;
        myRoomId = msg.roomId;
        ws.send(JSON.stringify({ type: 'joined', roomId: msg.roomId }));
        if (room.initiator) {
          room.initiator.send(JSON.stringify({ type: 'peer_joined' }));
        }
        console.log('User joined room:', msg.roomId);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Room not found or full' }));
      }
      
    } else if (msg.type === 'signal') {
      const room = rooms.get(msg.roomId);
      if (!room) return;
      const target = (room.initiator === ws) ? room.joiner : room.initiator;
      if (target && target.readyState === 1) {
        target.send(JSON.stringify({ type: 'signal', data: msg.data }));
      }
    } else if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });
  
  ws.on('close', () => {
    if (myRoomId) {
      const room = rooms.get(myRoomId);
      if (room) {
        rooms.delete(myRoomId);
        console.log('Room closed:', myRoomId);
        if (room.initiator && room.initiator !== ws && room.initiator.readyState === 1) {
          room.initiator.send(JSON.stringify({ type: 'peer_left' }));
        }
        if (room.joiner && room.joiner !== ws && room.joiner.readyState === 1) {
          room.joiner.send(JSON.stringify({ type: 'peer_left' }));
        }
      }
    }
  });
});
