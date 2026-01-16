// const express = require("express");
// const http = require("http");
// const { Server } = require("socket.io");
// const cors = require("cors");

// const app = express();
// app.use(cors());

// const server = http.createServer(app);

// const io = new Server(server, {
//   cors: { origin: "http://localhost:5173", methods: ["GET", "POST"] },
// });

// let rooms = {};

// io.on("connection", (socket) => {
//   console.log(`User Connected: ${socket.id}`);

//   // 1. Create Room (Host)
//   socket.on("create_room", (roomCode) => {
//     if (rooms[roomCode]) {
//       socket.emit("error_message", "Room already exists! Try another code.");
//       return;
//     }

//     // Create room with this socket as HOST
//     rooms[roomCode] = {
//       host: socket.id,       // Track who is admin
//       players: [socket.id],
//       readyPlayers: [],
//       turn: null,
//       marked: [],
//       gameActive: false
//     };

//     socket.join(roomCode);
//     socket.emit("room_created", { room: roomCode, isHost: true }); // Tell client they are host
//     console.log(`Room ${roomCode} created by ${socket.id}`);
//   });

//   // 2. Join Room (Player 2)
//   socket.on("join_room", (roomCode) => {
//     const room = rooms[roomCode];

//     if (!room) {
//       socket.emit("error_message", "Room does not exist!");
//       return;
//     }

//     if (room.players.length >= 2) {
//       socket.emit("error_message", "Room is full!");
//       return;
//     }

//     socket.join(roomCode);
//     room.players.push(socket.id);
    
//     // Tell client they joined successfully (isHost: false)
//     socket.emit("room_joined", { room: roomCode, isHost: false });
    
//     // Notify everyone in room that P2 is here
//     io.to(roomCode).emit("players_connected");
//     console.log(`User ${socket.id} joined Room ${roomCode}`);
//   });

//   // 3. Mark Ready
//   socket.on("player_ready", (roomCode) => {
//     const room = rooms[roomCode];
//     if (room) {
//       if (!room.readyPlayers.includes(socket.id)) {
//         room.readyPlayers.push(socket.id);
//       }

//       // If BOTH are ready
//       if (room.readyPlayers.length === 2) {
//         // Send specific event to HOST to enable the Start Button
//         io.to(room.host).emit("host_can_start");
//         // Send message to JOINER to wait
//         const joiner = room.players.find(id => id !== room.host);
//         if (joiner) {
//           io.to(joiner).emit("waiting_for_host");
//         }
//       }
//     }
//   });

//   // 4. Start Game (Only Host can trigger this)
//   socket.on("request_start_game", (roomCode) => {
//     const room = rooms[roomCode];
    
//     // Security check: Only host can start
//     if (room && socket.id === room.host && !room.gameActive) {
//       room.gameActive = true;
      
//       // Random first turn
//       const firstPlayer = room.players[Math.floor(Math.random() * 2)];
//       room.turn = firstPlayer;
      
//       io.to(roomCode).emit("game_start", { startTurn: firstPlayer });
//     }
//   });

//   // 5. Moves
//   socket.on("send_move", (data) => {
//     const { room, number } = data;
//     const roomData = rooms[room];

//     if (roomData && socket.id === roomData.turn) {
//       roomData.marked.push(number);
//       const nextTurn = roomData.players.find((id) => id !== socket.id);
//       roomData.turn = nextTurn;
//       io.to(room).emit("receive_move", { number, nextTurn });
//     }
//   });

//   // 6. Win
//   socket.on("game_won", ({ room }) => {
//     socket.to(room).emit("opponent_won");
//     if (rooms[room]) delete rooms[room]; // Cleanup room after game
//   });
// });

// server.listen(3001, () => {
//   console.log("SERVER RUNNING ON PORT 3001");
// });

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // Allow connection from any URL (for now)
    methods: ["GET", "POST"],
  },
});

let rooms = {};

io.on("connection", (socket) => {
  console.log(`User Connected: ${socket.id}`);

  // 1. Create Room
  socket.on("create_room", (roomCode) => {
    if (rooms[roomCode]) {
      socket.emit("error_message", "Room already exists! Try another code.");
      return;
    }
    rooms[roomCode] = {
      host: socket.id,
      players: [socket.id],
      readyPlayers: [],
      turn: null,
      marked: [],
      gameActive: false
    };
    socket.join(roomCode);
    socket.emit("room_created", { room: roomCode, isHost: true });
    console.log(`Room ${roomCode} created by ${socket.id}`);
  });

  // 2. Join Room
  socket.on("join_room", (roomCode) => {
    const room = rooms[roomCode];
    if (!room) {
      socket.emit("error_message", "Room does not exist!");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("error_message", "Room is full!");
      return;
    }
    socket.join(roomCode);
    room.players.push(socket.id);
    socket.emit("room_joined", { room: roomCode, isHost: false });
    io.to(roomCode).emit("players_connected");
    console.log(`User ${socket.id} joined Room ${roomCode}`);
  });

  // 3. Mark Ready
  socket.on("player_ready", (roomCode) => {
    const room = rooms[roomCode];
    if (room) {
      if (!room.readyPlayers.includes(socket.id)) {
        room.readyPlayers.push(socket.id);
      }
      if (room.readyPlayers.length === 2) {
        io.to(room.host).emit("host_can_start");
        const joiner = room.players.find(id => id !== room.host);
        if (joiner) io.to(joiner).emit("waiting_for_host");
      }
    }
  });

  // 4. Start Game
  socket.on("request_start_game", (roomCode) => {
    const room = rooms[roomCode];
    if (room && socket.id === room.host && !room.gameActive) {
      room.gameActive = true;
      const firstPlayer = room.players[Math.floor(Math.random() * 2)];
      room.turn = firstPlayer;
      io.to(roomCode).emit("game_start", { startTurn: firstPlayer });
    }
  });

  // 5. Moves
  socket.on("send_move", (data) => {
    const { room, number } = data;
    const roomData = rooms[room];
    if (roomData && socket.id === roomData.turn) {
      roomData.marked.push(number);
      const nextTurn = roomData.players.find((id) => id !== socket.id);
      roomData.turn = nextTurn;
      io.to(room).emit("receive_move", { number, nextTurn });
    }
  });

  // 6. Win
  socket.on("game_won", ({ room }) => {
    socket.to(room).emit("opponent_won");
    if (rooms[room]) delete rooms[room];
  });
  
  socket.on("disconnect", () => {
    // Cleanup logic if needed
  });
});

// IMPORTANT: Use process.env.PORT for Render
const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`SERVER RUNNING ON PORT ${PORT}`);
});