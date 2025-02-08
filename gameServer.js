const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

// Create an Express app
const app = express();

// Enable CORS for all origins (or specify particular domains if needed)
app.use(cors()); // This allows all origins by default

// Serve static files (like your index.html) from the 'public' folder
app.use(express.static("public")); // This will serve files like images, JS, CSS from the 'public' directory

// Create HTTP server and bind it to the Express app
const server = http.createServer(app);

// Create Socket.IO instance and attach it to the HTTP server
const io = socketIo(server, {
  cors: {
    origin: "*", // Allow all origins (you can replace "*" with a specific domain like 'http://localhost:3000')
    methods: ["GET", "POST"], // Allow these HTTP methods
    allowedHeaders: ["my-custom-header"], // Optional: if you have custom headers
    credentials: true, // Allow credentials like cookies to be sent
  },
});

// Store player information and game state
let players = [];
let calledNumbers = []; // Store called Bingo numbers
let currentTurnIndex = 0; // Track whose turn it is (index of players array)

// Function to generate a Bingo card
function generateBingoCard() {
  const numbers = Array.from({ length: 25 }, (_, i) => i + 1);

  // Shuffle the array of numbers to randomize their order
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]]; // Swap elements
  }

  const card = [];
  let count = 0;

  // Fill the 5x5 grid with the shuffled numbers
  for (let row = 0; row < 5; row++) {
    const rowValues = [];
    for (let col = 0; col < 5; col++) {
      rowValues.push(numbers[count]);
      count++;
    }
    card.push(rowValues);
  }

  return card;
}

// Function to check if a player has Bingo
function checkBingo(card) {
  // Check rows and columns
  for (let i = 0; i < 5; i++) {
    if (card[i].every((val) => calledNumbers.includes(val))) return true; // Row check
    if (
      card.every((row) => calledNumbers.includes(row[i])) // Column check
    )
      return true;
  }

  // Check diagonals
  if (
    card.every((row, index) => calledNumbers.includes(row[index])) // Top-left to bottom-right diagonal
  )
    return true;
  if (
    card.every((row, index) => calledNumbers.includes(row[4 - index])) // Top-right to bottom-left diagonal
  )
    return true;

  return false;
}

// Handle number calling and check for Bingo
function callNumber() {
  if (calledNumbers.length >= 75) return; // No more numbers to call

  let number;
  do {
    number = Math.floor(Math.random() * 75) + 1; // Random number between 1 and 75
  } while (calledNumbers.includes(number)); // Ensure the number is unique

  calledNumbers.push(number); // Store the called number

  console.log(`Called number: ${number}`);

  // Check if any player has Bingo
  for (let player of players) {
    if (checkBingo(player.card)) {
      io.emit("gameOver", player.id); // Announce the winner
      players = []; // Reset the game
      return;
    }
  }

  // Log the called numbers for debugging
  console.log(`Called Numbers: ${calledNumbers}`);
}

// Handle new connections
io.on("connection", (socket) => {
  console.log("A user connected");

  // Handle player joining the game
  socket.on("joinGame", () => {
    console.log("Player joined the game");
    const playerCard = generateBingoCard();
    players.push({ id: socket.id, card: playerCard });
    socket.emit("bingoCard", playerCard); // Send Bingo card to the player

    // Notify players of turn (for now, first player goes first)
    if (players.length === 2) {
      io.emit("yourTurn", true); // Player 1's turn
    }
  });

  // Handle number calling
  socket.on("callNumber", () => {
    const player = players.find((p) => p.id === socket.id);
    if (!player) return;

    // Only allow calling if it's the player's turn
    if (players[currentTurnIndex].id !== socket.id) {
      return;
    }

    // Call the number and switch turns
    callNumber();
    currentTurnIndex = (currentTurnIndex + 1) % players.length; // Switch to next player

    // Notify players whose turn it is
    io.emit("yourTurn", players[currentTurnIndex].id === socket.id);
    io.emit("numberCalled", calledNumbers[calledNumbers.length - 1]); // Broadcast the last called number
  });

  // Handle player disconnections
  socket.on("disconnect", () => {
    console.log(`Player ${socket.id} disconnected`);
    players = players.filter((player) => player.id !== socket.id);
  });
});

// Start the server on port 3000
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
