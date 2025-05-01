const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const socketIO = require('socket.io');
const User = require('./models/User');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIO(server);

mongoose.connect('mongodb+srv://infoaumebx:ernis2003@cluster007.vezhzdp.mongodb.net/chatdb?retryWrites=true&w=majority&appName=cluster007', {
    useNewUrlParser: true,
    useUnifiedTopology: true,
}).then(() => console.log('MongoDB Connected'))
  .catch(err => console.log(err));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/register', async (req, res) => {
    try {
        const { name, password } = req.body;
        const existingUser = await User.findOne({ name });
        if (existingUser) {
            return res.status(400).json({ success: false, message: 'User already exists' });
        }
        const newUser = new User({ name, password });
        await newUser.save();
        res.json({ success: true, user: newUser });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

app.post('/login', async (req, res) => {
    try {
        const { name, password } = req.body;
        const user = await User.findOne({ name, password });
        if (!user) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }
        res.json({ success: true, user });
    } catch (err) {
        res.status(500).json({ success: false, error: err.message });
    }
});

const users = {};

io.on('connection', socket => {
    console.log('User connected: ' + socket.id);

    socket.on('registerId', (userId) => {
        users[userId] = socket.id;
        console.log('Registered userId:', userId);
    });

    socket.on('connectWithUser', ({ myId, friendId }) => {
        const friendSocketId = users[friendId];
        if (friendSocketId) {
            socket.join(friendId);
            socket.emit('connected', { success: true });
        } else {
            socket.emit('connected', { success: false, message: 'Friend not found!' });
        }
    });

    socket.on('sendMessage', async ({ friendId, message, senderId }) => {
        try {
            const sender = await User.findById(senderId);
            const senderName = sender ? sender.name : 'Anonymous';

            const friendSocketId = users[friendId];
            const senderSocketId = users[senderId];

            if (friendSocketId) {
                io.to(friendSocketId).emit('receiveMessage', { message, senderName, senderId });
            }

            if (senderSocketId && senderSocketId !== friendSocketId) {
                io.to(senderSocketId).emit('receiveMessage', { message, senderName, senderId });
            }
        } catch (error) {
            console.error('Error sending message:', error);
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected: ' + socket.id);
        for (let userId in users) {
            if (users[userId] === socket.id) {
                delete users[userId];
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 4004;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
