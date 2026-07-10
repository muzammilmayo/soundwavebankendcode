const jwt = require("jsonwebtoken");

const verifyToken = (req, res, next) => {
    // Try to get token from Authorization header first
    let token;
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.split(' ')[1];
    } else if (req.cookies && req.cookies.auth_token) {
        // Fallback to HttpOnly cookie
        token = req.cookies.auth_token;
    }

    if (!token) {
        return res.status(401).json({ message: "No Token" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Token Expired or Invalid" });
    }
};

module.exports = verifyToken;