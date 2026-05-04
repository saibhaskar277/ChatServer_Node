const http = require("http");
const { Server } = require("socket.io");

// Create HTTP server
const server = http.createServer();

// Socket.IO setup
const io = new Server(server, {
  cors: {
    origin: "*", // allow all origins (ok for testing)
    methods: ["GET", "POST"],
  },
  transports: ["websocket", "polling"], // better compatibility
});

// Room storage
const rooms = {};
const MAX_PLAYERS = 5;

io.on("connection", (socket) => {
  console.log("Connected:", socket.id);

  // JOIN ROOM
  socket.on("join_room", ({ room, username }) => {
    if (!room || !username) return;

    if (!rooms[room]) rooms[room] = new Map();

    if (rooms[room].size >= MAX_PLAYERS) {
      socket.emit("room_full");
      return;
    }

    socket.join(room);

    const player = {
      id: socket.id,
      username,
    };

    socket.data.room = room;
    socket.data.username = username;

    rooms[room].set(socket.id, player);

    sendRoomState(room);

    io.to(room).emit("chat_message", {
      username: "System",
      message: `${username} joined`,
    });
  });

  // CHAT
  socket.on("chat_message", ({ message }) => {
    const room = socket.data.room;
    if (!room || !message) return;

    io.to(room).emit("chat_message", {
      username: socket.data.username,
      message,
    });
  });

  // NUMBER PICK
  socket.on("choose_number", ({ number }) => {
    const room = socket.data.room;
    if (!room) return;

    const num = parseInt(number);
    if (!num || num < 1 || num > 100) return;

    io.to(room).emit("display_number", {
      username: socket.data.username,
      number: num,
    });
  });

  // DISCONNECT
  socket.on("disconnect", () => {
    const room = socket.data.room;
    const username = socket.data.username;

    if (room && rooms[room]) {
      rooms[room].delete(socket.id);

      if (rooms[room].size === 0) {
        delete rooms[room];
      } else {
        sendRoomState(room);

        io.to(room).emit("chat_message", {
          username: "System",
          message: `${username ?? "A player"} left`,
        });
      }
    }

    console.log("Disconnected:", socket.id);
  });

  // SEND ROOM STATE
  function sendRoomState(room) {
    if (!rooms[room]) return;

    const players = Array.from(rooms[room].values());

    io.to(room).emit("room_state", {
      players,
    });
  }
});

// 🔥 IMPORTANT: Render dynamic port
const PORT = process.env.PORT || 3000;

server.listen(PORT, "0.0.0.0", () => {
  console.log("Server running on port", PORT);
});
