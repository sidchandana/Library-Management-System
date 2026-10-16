const jwt = require('jsonwebtoken');
const Admin = require('../model/adminSchema');


const secretKey = process.env.SECRET_KEY;
const AuthenticateAdmin = async (req, res, next) => {
  try {
    const token = req.cookies.jwtoken_admin;
    if (!token) {
      throw new Error('No token provided');
    }

    const verifyToken = jwt.verify(token, secretKey);

    const rootAdmin = await Admin.findOne({ _id: verifyToken._id, "tokens.token": token });

    if (!rootAdmin) {
      throw new Error('User not found');
    }

    req.token = token;
    req.rootAdmin = rootAdmin;
    req.adminID = rootAdmin._id;

    next();
  } catch (err) {
    res.status(401).send('Unauthorized: Invalid token');
    console.error('Authentication error:', err.message);
  }
}

module.exports = AuthenticateAdmin;
