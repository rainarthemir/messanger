import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ port: process.env.PORT || 8080 });
const rooms = new Map();

console.log('Chat server running');

wss.on('connection', (ws) => {
  let currentRoom = null;

  ws.on('message', (raw) => {
    const msg = JSON.parse(raw.toString());
    
    if (msg.type === 'create') {
      const roomId = Math.random().toString(36).slice(2, 8);
      rooms.set(roomId, [ws]);
      currentRoom = roomId;
      ws.send(JSON.stringify({ type: 'created', roomId }));
      console.log('Room created:', roomId);
      
    } else if (msg.type === 'join') {
      const room = rooms.get(msg.roomId);
      if (room && room.length < 2) {
        room.push(ws);
        currentRoom = msg.roomId;
        ws.send(JSON.stringify({ type: 'joined', roomId: msg.roomId }));
        
        // Сообщаем первому пользователю, что кто-то зашёл
        if (room[0] && room[0] !== ws) {
          room[0].send(JSON.stringify({ type: 'peer_joined' }));
        }
        console.log('User joined room:', msg.roomId);
      } else {
        ws.send(JSON.stringify({ type: 'error', message: 'Room is full or not exists' }));
      }
      
    } else if (msg.type === 'message') {
      // Пересылаем сообщение другому участнику комнаты
      const room = rooms.get(currentRoom);
      if (room) {
        const other = room.find(client => client !== ws);
        if (other && other.readyState === 1) {
          other.send(JSON.stringify({ 
            type: 'message', 
            text: msg.text,
            from: msg.from || 'friend'
          }));
          console.log('Message relayed in room:', currentRoom);
        } else {
          ws.send(JSON.stringify({ type: 'error', message: 'Peer disconnected' }));
        }
      }
    }
  });
  
  ws.on('close', () => {
    if (currentRoom) {
      const room = rooms.get(currentRoom);
      if (room) {
        const remaining = room.filter(client => client !== ws);
        if (remaining.length === 0) {
          rooms.delete(currentRoom);
          console.log('Room deleted:', currentRoom);
        } else {
          rooms.set(currentRoom, remaining);
          // Сообщаем оставшемуся, что собеседник ушёл
          if (remaining[0] && remaining[0].readyState === 1) {
            remaining[0].send(JSON.stringify({ type: 'peer_left' }));
          }
        }
      }
    }
  });
});
