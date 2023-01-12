const admin = require("./config/firebase-config");

module.exports.decodeToken = async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  try {
    const decodeValue = await admin.auth().verifyIdToken(token);
    if (decodeValue) {
      console.log(decodeValue);
      req.user = decodeValue["user_id"];
      return next();
    }
    return res.status(403).json({message: "Unauthorized"});
  } catch (e) {
    return res.status(500).json({message: "Internal Error"});
  }
};
