const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

let players = {};
let readyPlayers = 0;
let currentTurn = null;

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

io.on("connection", (socket) => {
  console.log("🟢 Player connected:", socket.id);

  players[socket.id] = {
    board: generateBoard(),
    marked: [],
  };

  socket.emit("init", {
    board: players[socket.id].board,
  });

  socket.on("ready", () => {
    console.log("✅ Player ready:", socket.id);
    readyPlayers++;

    if (readyPlayers === Object.keys(players).length) {
      currentTurn = Object.keys(players)[0]; // first player starts
      io.emit("start_game", { turn: currentTurn });
    }
  });

  socket.on("call_number", (number) => {
    if (socket.id !== currentTurn) return;

    io.emit("number_called", { number });

    const ids = Object.keys(players);
    const idx = ids.indexOf(currentTurn);
    currentTurn = ids[(idx + 1) % ids.length];
  });

//   socket.on("win", () => {
//     io.emit("winner", `🎉 Player ${socket.id.slice(0, 5)} wins!`);
//   });

    socket.on("win", () => {
    io.to(socket.id).emit("winner", "YOU_WIN");
    socket.broadcast.emit("winner", "OPPONENT_WIN");
    });

  socket.on("disconnect", () => {
    console.log("🔴 Player disconnected:", socket.id);
    delete players[socket.id];
    readyPlayers = Math.max(0, readyPlayers - 1);
  });
});

// server.listen(4000, () => {
//   console.log("✅ Bingo server running on port 4000");
// });

const PORT = process.env.PORT || 4000;

server.listen(PORT, () => {
  console.log("✅ Bingo server running on port", PORT);
});
