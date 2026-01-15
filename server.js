// const express = require("express");
// const http = require("http");
// const { Server } = require("socket.io");

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: "*" },
//   pingInterval: 25000,
//   pingTimeout: 60000,
// });

// let players = {};
// let readyPlayers = 0;
// let currentTurn = null;

// function generateBoard() {
//   const nums = Array.from({ length: 25 }, (_, i) => i + 1).sort(
//     () => Math.random() - 0.5
//   );
//   let board = [];
//   for (let i = 0; i < 5; i++) {
//     board.push(nums.slice(i * 5, i * 5 + 5));
//   }
//   return board;
// }

// io.on("connection", (socket) => {
//   console.log("🟢 Player connected:", socket.id);

//   players[socket.id] = {
//     board: generateBoard(),
//     marked: [],
//   };

//   socket.emit("init", {
//     board: players[socket.id].board,
//   });

//   socket.on("ready", () => {
//     console.log("✅ Player ready:", socket.id);
//     readyPlayers++;

//     if (readyPlayers === Object.keys(players).length) {
//       currentTurn = Object.keys(players)[0]; // first player starts
//       io.emit("start_game", { turn: currentTurn });
//     }
//   });

//   socket.on("call_number", (number) => {
//     if (socket.id !== currentTurn) return;

//     io.emit("number_called", { number });

//     const ids = Object.keys(players);
//     const idx = ids.indexOf(currentTurn);
//     currentTurn = ids[(idx + 1) % ids.length];
//   });

// //   socket.on("win", () => {
// //     io.emit("winner", `🎉 Player ${socket.id.slice(0, 5)} wins!`);
// //   });

//     socket.on("win", () => {
//     io.to(socket.id).emit("winner", "YOU_WIN");
//     socket.broadcast.emit("winner", "OPPONENT_WIN");
//     });

//   socket.on("disconnect", () => {
//     console.log("🔴 Player disconnected:", socket.id);
//     delete players[socket.id];
//     readyPlayers = Math.max(0, readyPlayers - 1);
//   });
// });

// // server.listen(4000, () => {
// //   console.log("✅ Bingo server running on port 4000");
// // });

// const PORT = process.env.PORT || 4000;

// server.listen(PORT, () => {
//   console.log("✅ Bingo server running on port", PORT);
// });


const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
  pingInterval: 25000,
  pingTimeout: 60000,
});

// ----- DATA STRUCTURES -----
const rooms = {}; // roomId -> { players: [], ready: Set, turnIndex: 0 }

function generateBoard() {
  const nums = Array.from({ length: 25 }, (_, i) => i + 1).sort(
    () => Math.random() - 0.5
  );
  let board = [];
  for (let i = 0; i < 5; i++) {
    board.push(nums.slice(i * 5, i * 5 + 5));
  }
  return board;
}

// ----- SOCKET CONNECTION -----
io.on("connection", (socket) => {
  console.log("🟢 Player connected:", socket.id);

  socket.on("join_room", (roomId) => {
    socket.join(roomId);

    if (!rooms[roomId]) {
      rooms[roomId] = {
        players: [],
        ready: new Set(),
        turnIndex: 0,
        boards: {}, // playerId -> board
      };
    }

    const room = rooms[roomId];

    if (!room.players.includes(socket.id)) room.players.push(socket.id);

    // Assign board
    room.boards[socket.id] = generateBoard();

    socket.emit("init", { board: room.boards[socket.id] });

    console.log(`Room ${roomId} players:`, room.players);
  });

  socket.on("ready", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    room.ready.add(socket.id);

    console.log(`Player ready: ${socket.id} (${room.ready.size}/${room.players.length})`);

    // Start game when all players are ready (assuming 2 players)
    if (room.ready.size === room.players.length && room.players.length === 2) {
      const turnPlayer = room.players[room.turnIndex];
      io.to(roomId).emit("start_game", { turn: turnPlayer });
    }
  });

  socket.on("call_number", ({ roomId, number }) => {
    const room = rooms[roomId];
    if (!room) return;

    const currentPlayerId = room.players[room.turnIndex];
    if (socket.id !== currentPlayerId) return; // Not this player's turn

    io.to(roomId).emit("number_called", { number });

    // Next turn
    room.turnIndex = (room.turnIndex + 1) % room.players.length;
  });

  socket.on("win", (roomId) => {
    const room = rooms[roomId];
    if (!room) return;

    // Notify winner and opponent separately
    socket.emit("winner", "YOU_WIN");
    socket.to(roomId).emit("winner", "OPPONENT_WIN");
  });

  socket.on("disconnect", () => {
    console.log("🔴 Player disconnected:", socket.id);

    // Remove from rooms
    for (const roomId in rooms) {
      const room = rooms[roomId];

      if (room.players.includes(socket.id)) {
        room.players = room.players.filter((id) => id !== socket.id);
        room.ready.delete(socket.id);
        delete room.boards[socket.id];

        // If no players left, delete room
        if (room.players.length === 0) {
          delete rooms[roomId];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log("✅ Bingo server running on port", PORT);
});
