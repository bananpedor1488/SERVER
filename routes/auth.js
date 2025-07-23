const express = require('express');
const bcrypt = require('bcrypt');
const User = require('../models/User');
const router = express.Router();
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('connect.sid');
    res.json({ message: 'Logged out' });
  });
});

router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  const user = await User.create({ username, email, password: hash });
  req.session.user = { id: user._id, username: user.username };
  res.json({ user: req.session.user });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({
    $or: [{ email }, { username: email }]
  });

  if (!user) return res.status(400).json({ message: 'User not found' });

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) return res.status(401).json({ message: 'Invalid credentials' });

  req.session.user = { id: user._id, username: user.username };
  res.json({ user: req.session.user });
});

module.exports = router;
