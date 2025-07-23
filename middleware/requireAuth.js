const requireAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Не авторизован' });
  }
  next();
};

module.exports = requireAuth;
