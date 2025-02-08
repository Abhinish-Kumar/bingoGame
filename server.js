const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const cors = require("cors");

// Create an Express app
const app = express();

// Enable CORS for all origins (or specify particular domains if needed)
app.use(cors()); // This allows all origins by default

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

// Serve a simple HTML file (index.html) to the client
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/index.html"); // Serve index.html when client visits root
});

// Track waiting players
let waitingPlayers = [];

app.use(express.static("public"));

//generate BINGO card
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

io.on("connection", (socket) => {
  console.log("A user connected");

  // Create a Map to store clicked numbers for each player
  const playerClickedNumbers = new Map();

  // Listen for player readiness
  socket.on("readyToPlay", () => {
    console.log(`Player with socket id ${socket.id} is ready`);

    // Add player to waiting list
    waitingPlayers.push(socket);

    // Check if we have two players
    if (waitingPlayers.length >= 2) {
      // Match the first two players
      const player1 = waitingPlayers.shift(); // Remove the first player
      const player2 = waitingPlayers.shift(); // Remove the second player

      // Notify players that they've been matched
      player1.emit("startGame", {
        opponent: player2.id,
        card: generateBingoCard(),
      });
      player2.emit("startGame", {
        opponent: player1.id,
        card: generateBingoCard(),
      });

      console.log("Players have been matched");

      // Initialize clicked numbers for each player
      playerClickedNumbers.set(player1.id, []);
      playerClickedNumbers.set(player2.id, []);

      // Listen for the click events from player1
      player1.on("click", (clickedNumber) => {
        // Push the clicked number to the player1's array in the map
        playerClickedNumbers.get(player1.id).push(clickedNumber);
        console.log(
          `Player 1 (ID: ${player1.id}) clicked:`,
          playerClickedNumbers.get(player1.id)
        );
        player2.emit("opponentClicked", clickedNumber);
      });

      // Listen for the click events from player2
      player2.on("click", (clickedNumber) => {
        // Push the clicked number to the player2's array in the map
        playerClickedNumbers.get(player2.id).push(clickedNumber);
        console.log(
          `Player 2 (ID: ${player2.id}) clicked:`,
          playerClickedNumbers.get(player2.id)
        );
        player1.emit("opponentClicked", clickedNumber);
      });
    }
  });

  socket.on("disconnect", () => {
    console.log(`Player with socket id ${socket.id} disconnected`);
    // Remove the player from the waiting list if they disconnect
    waitingPlayers = waitingPlayers.filter((player) => player.id !== socket.id);

    // Clean up the clicked numbers map for the disconnected player
    playerClickedNumbers.delete(socket.id);
  });
});

// Start the server on port 3000
server.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
