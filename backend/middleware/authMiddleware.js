const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "default_jwt_secret_key_change_in_production";

function verifyToken(req, res, next) {
    const authHeader = req.headers["authorization"] || req.headers["Authorization"];

    let token = null;
    if (authHeader && authHeader.startsWith("Bearer")) {
        token = authHeader.split(" ")[1];
    } else if (req.headers["x-access-token"]) {
        token = req.headers["x-access-token"];
    }

    if (!token) {
        return res.status(401).json({ message: "Access denied. No token provided." });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        return res.status(401).json({ message: "Invalid or expired token." });
    }
}

module.exports = { verifyToken, JWT_SECRET };
