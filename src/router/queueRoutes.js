const express = require("express");
const router = express.Router();
const { joinQueue } = require("../controllers/queueController");
const authMiddleware = require("../middleware/authMiddleware");

router.use(authMiddleware)
router.post("/join",joinQueue);

module.exports = router;