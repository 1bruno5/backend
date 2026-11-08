const jwt = require("jsonwebtoken");


function authenticate(req, res, next) {
    const header = req.headers.authorization; 

    
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ message: "Access denied: no token provided" });
    }

    const token = header.split(" ")[1];

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        next();
    } catch (err) {
        // Invalid or expired token -> 403
        const message = err.name === "TokenExpiredError" ? "Token has expired" : "Invalid token";
        return res.status(403).json({ message });
    }
}

module.exports = { authenticate };
