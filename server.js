/* server.js
const express = require('express');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));
app.use(cors());

// MongoDB Connection
mongoose.connect("mongodb://127.0.0.1:27017/hospitalDB");
mongoose.connection.on("connected", () => {
  console.log("✅ MongoDB connected successfully (local)");
});
mongoose.connection.on("error", (err) => {
  console.error("❌ MongoDB connection error:", err);
});
const guestSchema = new mongoose.Schema({
  fullname: String,
  phone: String,
  email: String,
  password: String,
  roomId: Number,
  otp: String
});

const Guest = mongoose.model('Guest', guestSchema);

const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: "leotitogalaxy@gmail.com",
      pass: "anxd ruea situ btug", // Replace with your email password
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });
  

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

app.post('/register', async (req, res) => {
  const { fullname, phone, email, password, confirmPassword, roomId } = req.body;
  if (password !== confirmPassword) return res.status(400).send("Passwords don't match");

  const otp = generateOTP();
  const guest = new Guest({ fullname, phone, email, password, roomId, otp });
  await guest.save();

  await transporter.sendMail({
    to: email,
    subject: "Welcome to Leo Mwahalende Guest House",
    text: `Welcome ${fullname}, your OTP is: ${otp}`
  });

  res.send("Guest registered and OTP sent!");
});

app.post('/login', async (req, res) => {
  const { identifier, password } = req.body;
  const guest = await Guest.findOne({ $or: [{ phone: identifier }, { email: identifier }] });

  if (!guest || guest.password !== password) return res.status(400).send("Invalid credentials");
  res.json({ roomId: guest.roomId, otp: guest.otp, id: guest._id });
});

app.get('/esp32/otp/:roomId', async (req, res) => {
  const guest = await Guest.findOne({ roomId: req.params.roomId });
  if (!guest) return res.status(404).send("Guest not found");
  res.json({ otp: guest.otp });
});

app.post('/esp32/send/:id', async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) return res.status(404).send("Guest not found");
  // Simulated door close signal
  res.send("Door close signal sent");
});

// Admin Panel
app.get('/admin/guests', async (req, res) => {
  const guests = await Guest.find();
  res.json(guests);
});

app.delete('/admin/delete/:id', async (req, res) => {
  await Guest.findByIdAndDelete(req.params.id);
  res.send("Guest deleted");
});

app.put('/admin/update/:id', async (req, res) => {
  const { phone, email, roomId } = req.body;
  await Guest.findByIdAndUpdate(req.params.id, { phone, email, roomId });
  res.send("Guest updated");
});

app.post('/admin/resend/:id', async (req, res) => {
  const guest = await Guest.findById(req.params.id);
  if (!guest) return res.status(404).send("Guest not found");

  await transporter.sendMail({
    to: guest.email,
    subject: "Resent OTP - Leo Mwahalende Guest House",
    text: `Dear ${guest.fullname}, your OTP is: ${guest.otp}`
  });

  res.send("OTP resent successfully");
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
*/


const express = require('express');
const mongoose = require('mongoose');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);
const port = 3000;

// MongoDB Connection
mongoose.connect('mongodb://127.0.0.1:27017/albert')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => console.log('❌ DB connection error:', err));

// Schema
const UserSchema = new mongoose.Schema({
  fullname: String,
  email: String,
  roomName: String,
  password: String,
  otp: String
});
const User = mongoose.model('User', UserSchema);

// Middleware
app.set("viewengine","ejs");
app.use(express.json());
app.use(express.static('public')); // login, register, admin.html
app.use('/protected', express.static(path.join(__dirname, 'protected'))); // dashboard.html

// OTP generator
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Mailer setup
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  auth: {
    user: "zumalipas@gmail.com",
    pass: "xsds bimk ndlb vmrr", // Replace with your email password
  },
  connectionTimeout: 10000,
  greetingTimeout: 10000,
  socketTimeout: 10000,
});

// WebSocket connection
io.on('connection', socket => {
  console.log('📡 WebSocket client connected');
});
//welcome to albert house
app.get("/",(req,res)=>{
res.render("welcom.ejs")
})
// ========== Guest Registration ==========
app.post('/register', async (req, res) => {
  const { fullname, email, roomName, password } = req.body;

  const roomExists = await User.findOne({ roomName });
  if (roomExists) return res.status(400).json({ error: "Room already occupied" });

  const emailExists = await User.findOne({ email });
  if (emailExists) return res.status(400).json({ error: "Email already registered" });

  const otp = generateOTP();
  const hashedPassword = await bcrypt.hash(password, 10);

  const user = new User({ fullname, email, roomName, password: hashedPassword, otp });
  await user.save();

  // Send OTP
  transporter.sendMail({
    from: 'zumalipas@gmail.com',
    to: email,
    subject: 'Your PIN for Albert Guest House',
    text: `Hello ${fullname}, your OTP is: ${otp}`
  });

  console.log("📨 PIN sent via email. BLE sync will happen on dashboard.");
  res.status(200).json({ message: 'User registered' });
});

// ========== Guest Login ==========
app.post('/login', async (req, res) => {
  const { roomName, password } = req.body;

  const user = await User.findOne({ roomName });
  if (!user || !(await bcrypt.compare(password, user.password))) {
    return res.status(400).json({ error: "Invalid credentials" });
  }

  res.status(200).json({
    message: 'Login successful',
    user: {
      fullname: user.fullname,
      roomName: user.roomName,
      otp: user.otp
    }
  });
});

// ========== Fetch OTP by Room ==========
app.get('/user/:roomName', async (req, res) => {
  const user = await User.findOne({ roomName: req.params.roomName });
  if (!user) return res.status(404).json({ error: "User not found" });

  res.json({
    fullname: user.fullname,
    roomName: user.roomName,
    otp: user.otp
  });
});

// ========== Admin Routes ==========

// Get all users
app.get('/admin/users', async (req, res) => {
  const users = await User.find();
  res.json(users);
});

// Delete user
app.delete('/admin/delete/:id', async (req, res) => {
  await User.findByIdAndDelete(req.params.id);
  res.json({ message: "User deleted" });
});

// Resend OTP (and push update to WebSocket)
app.put('/admin/resend/:id', async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const newOTP = generateOTP();
  user.otp = newOTP;
  await user.save();

  transporter.sendMail({
    from: 'zumalipas@gmail.com',
    to: user.email,
    subject: 'Your new PIN for Albert Guest House',
    text: `Hello ${user.fullname}, your new PIN is: ${newOTP}`
  });

  // Emit update to all WebSocket clients
  io.emit('otpUpdated', {
    roomName: user.roomName,
    otp: newOTP
  });

  res.json({ message: "PIN resent", otp: newOTP });
});

// Update user info
app.put('/admin/update/:id', async (req, res) => {
  const { fullname, email, roomName } = req.body;
  const user = await User.findById(req.params.id);
  if (!user) return res.status(404).json({ error: "User not found" });

  const existing = await User.findOne({ roomName });
  if (existing && existing._id.toString() !== req.params.id) {
    return res.status(400).json({ error: "Room already in use" });
  }

  user.fullname = fullname;
  user.email = email;
  user.roomName = roomName;
  await user.save();

  res.json({ message: "User updated" });
});

// Prevent direct dashboard access
app.get('/dashboard.html', (req, res) => {
  res.redirect('/login.html');
});

// Start server
server.listen(port, () => {
  console.log(`🚀 Server running at http://localhost:${port}`);
});
