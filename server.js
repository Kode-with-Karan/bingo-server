const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

const SIZE = 5;

let players = {};      // { socketId: { board, ready } }
let readyPlayers = 0;
let currentTurn = null;
let calledNumbers = [];

function generateBoard() {
  const nums = Array.from({ length: SIZE * SIZE }, (_, i) => i + 1).sort(() => Math.random() - 0.5);
  let k = 0;
  return Array.from({ length: SIZE }, () =>
    Array.from({ length: SIZE }, () => nums[k++])
  );
}

function checkWin(marked) {
  let lines = 0;

  // rows
  for (let i = 0; i < SIZE; i++) if (marked[i].every(Boolean)) lines++;

  // columns
  for (let j = 0; j < SIZE; j++) {
    let col = true;
    for (let i = 0; i < SIZE; i++) if (!marked[i][j]) col = false;
    if (col) lines++;
  }

  // diagonals
  let d1 = true, d2 = true;
  for (let i = 0; i < SIZE; i++) {
    if (!marked[i][i]) d1 = false;
    if (!marked[i][SIZE - i - 1]) d2 = false;
  }
  if (d1) lines++;
  if (d2) lines++;

  return lines >= 5;
}

io.on("connection", (socket) => {
  console.log("Player connected:", socket.id);
  players[socket.id] = { board: generateBoard(), ready: false };

  // Send initial board
  socket.emit("init", { board: players[socket.id].board });

  // Player clicks ready/start
  socket.on("ready", () => {
    players[socket.id].ready = true;
    readyPlayers++;

    // Start game if all players are ready
    const allReady = Object.values(players).every((p) => p.ready);
    if (allReady) {
      const playerIds = Object.keys(players);
      currentTurn = playerIds[Math.floor(Math.random() * playerIds.length)];
      calledNumbers = [];
      io.emit("start_game", { turn: currentTurn });
    }
  });

  // Player calls a number
  socket.on("call_number", (number) => {
    if (socket.id !== currentTurn) return;

    calledNumbers.push(number);

    // Broadcast called number
    io.emit("number_called", { number });

    // Rotate turn
    const playerIds = Object.keys(players);
    const idx = playerIds.indexOf(socket.id);
    currentTurn = playerIds[(idx + 1) % playerIds.length];
  });

  // Player declares win
  socket.on("win", () => {
    io.emit("winner", socket.id === currentTurn ? "YOU_WIN" : "OPPONENT_WIN");
  });

  // Disconnect
  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    readyPlayers = Object.values(players).filter((p) => p.ready).length;
  });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log("✅ Bingo server running on port", PORT);
});
