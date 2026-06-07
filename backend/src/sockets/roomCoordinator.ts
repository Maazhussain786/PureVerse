import { Server, Socket } from 'socket.io';

interface RoomState {
  mediaId: string;
  type: string;
  episode?: string;
  currentTime: number;
  isPlaying: boolean;
  members: string[];
}

const rooms = new Map<string, RoomState>();

export default function setupSockets(io: Server) {
  io.on('connection', (socket: Socket) => {
    console.log(`User connected: ${socket.id}`);

    socket.on('join_room', (data: { roomCode: string, mediaId: string, type: string }) => {
      const { roomCode, mediaId, type } = data;
      socket.join(roomCode);
      
      if (!rooms.has(roomCode)) {
        rooms.set(roomCode, {
          mediaId,
          type,
          currentTime: 0,
          isPlaying: false,
          members: [socket.id]
        });
      } else {
        const room = rooms.get(roomCode)!;
        room.members.push(socket.id);
        // Sync the new user with current state
        socket.emit('sync_state', room);
      }
      
      console.log(`User ${socket.id} joined room ${roomCode}`);
    });

    socket.on('play', (roomCode: string) => {
      if (rooms.has(roomCode)) {
        rooms.get(roomCode)!.isPlaying = true;
        socket.to(roomCode).emit('play');
      }
    });

    socket.on('pause', (roomCode: string) => {
      if (rooms.has(roomCode)) {
        rooms.get(roomCode)!.isPlaying = false;
        socket.to(roomCode).emit('pause');
      }
    });

    socket.on('seek', (data: { roomCode: string, time: number }) => {
      if (rooms.has(data.roomCode)) {
        rooms.get(data.roomCode)!.currentTime = data.time;
        socket.to(data.roomCode).emit('seek', data.time);
      }
    });

    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.id}`);
      // Remove user from rooms
      rooms.forEach((room, code) => {
        room.members = room.members.filter(id => id !== socket.id);
        if (room.members.length === 0) {
          rooms.delete(code); // Clean up empty rooms
        }
      });
    });
  });
}
