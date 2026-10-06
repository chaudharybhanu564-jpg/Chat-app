const express = require("express");
const http = require("http");
const path = require("path");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/chatapp";
const JWT_SECRET = process.env.JWT_SECRET || "dev_secret_change_me";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },

    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },

    bio: {
      type: String,
      default: "Hey there! I am using ChatApp.",
      trim: true,
      maxlength: 200
    },

    password: {
      type: String,
      required: true
    },

    online: {
      type: Boolean,
      default: false
    },

    lastSeen: {
      type: Date,
      default: Date.now
    }
  },
  { timestamps: true }
);

const messageSchema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    receiver: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },

    text: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000
    },

    read: {
      type: Boolean,
      default: false
    }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Message = mongoose.model("Message", messageSchema);

function sign(user) {
  return jwt.sign(
    { id: user._id.toString() },
    JWT_SECRET,
    { expiresIn: "7d" }
  );
}

function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || "").replace(
      "Bearer ",
      ""
    );

    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({
      error: "Please login again."
    });
  }
}


/* REGISTER */

app.post("/api/register", async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password || password.length < 6) {
      return res.status(400).json({
        error:
          "Name, email and a 6+ character password are required."
      });
    }

    const exists = await User.findOne({
      email: email.toLowerCase()
    });

    if (exists) {
      return res.status(409).json({
        error: "Email already registered."
      });
    }

    const hash = await bcrypt.hash(password, 10);

    const user = await User.create({
      name,
      email,
      password: hash
    });

    res.json({
      token: sign(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio
      }
    });

  } catch (e) {
    res.status(500).json({
      error: "Registration failed."
    });
  }
});


/* LOGIN */

app.post("/api/login", async (req, res) => {
  try {
    const user = await User.findOne({
      email: (req.body.email || "").toLowerCase()
    });

    if (
      !user ||
      !(await bcrypt.compare(
        req.body.password || "",
        user.password
      ))
    ) {
      return res.status(401).json({
        error: "Invalid email or password."
      });
    }

    res.json({
      token: sign(user),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio
      }
    });

  } catch (e) {
    res.status(500).json({
      error: "Login failed."
    });
  }
});


/* UPDATE PROFILE */

app.put("/api/profile", auth, async (req, res) => {
  try {
    const { name, bio } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Name is required."
      });
    }

    if ((bio || "").length > 200) {
      return res.status(400).json({
        error: "Bio must be 200 characters or less."
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name: name.trim(),
        bio: (bio || "").trim()
      },
      {
        new: true,
        runValidators: true
      }
    );

    if (!user) {
      return res.status(404).json({
        error: "User not found."
      });
    }

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio
      }
    });

  } catch (e) {
    res.status(500).json({
      error: "Profile update failed."
    });
  }
});


/* USERS */

app.get("/api/users", auth, async (req, res) => {
  const users = await User.find({
    _id: { $ne: req.user.id }
  })
    .select("name email online lastSeen")
    .sort({ name: 1 });

  res.json(users);
});


/* MESSAGES */

app.get("/api/messages/:userId", auth, async (req, res) => {
  const messages = await Message.find({
    $or: [
      {
        sender: req.user.id,
        receiver: req.params.userId
      },
      {
        sender: req.params.userId,
        receiver: req.user.id
      }
    ]
  })
    .sort({ createdAt: 1 })
    .limit(500);

  res.json(messages);
});


/* ONLINE STATUS */

async function setOnline(id, value) {
  await User.findByIdAndUpdate(id, {
    online: value,
    lastSeen: new Date()
  });

  io.emit("presence", {
    userId: id,
    online: value,
    lastSeen: new Date()
  });
}


/* SOCKET AUTH */

io.use((socket, next) => {
  try {
    socket.user = jwt.verify(
      socket.handshake.auth.token,
      JWT_SECRET
    );

    next();
  } catch {
    next(new Error("Unauthorized"));
  }
});


/* SOCKET CONNECTION */

io.on("connection", async (socket) => {
  await setOnline(socket.user.id, true);


  /* SEND MESSAGE */

  socket.on("send_message", async ({ receiverId, text }) => {
    if (!receiverId || !text || !text.trim()) {
      return;
    }

    const msg = await Message.create({
      sender: socket.user.id,
      receiver: receiverId,
      text: text.trim()
    });

    const payload = {
      id: msg._id,
      sender: msg.sender,
      receiver: msg.receiver,
      text: msg.text,
      read: msg.read,
      createdAt: msg.createdAt
    };

    io.to(socket.id).emit("message", payload);

    for (const [id, s] of io.sockets.sockets) {
      if (
        s.user &&
        s.user.id === receiverId
      ) {
        s.emit("message", payload);
      }
    }
  });


  /* TYPING */

  socket.on("typing", ({ receiverId, typing }) => {
    for (const [id, s] of io.sockets.sockets) {
      if (
        s.user &&
        s.user.id === receiverId
      ) {
        s.emit("typing", {
          userId: socket.user.id,
          typing
        });
      }
    }
  });


  /* DISCONNECT */

  socket.on("disconnect", () => {
    setOnline(socket.user.id, false);
  });
});


/* START SERVER */

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    server.listen(PORT, () => {
      console.log(
        `ChatApp running at http://localhost:${PORT}`
      );
    });
  })
  .catch((err) => {
    console.error(
      "MongoDB connection failed:",
      err.message
    );

    process.exit(1);
  });
