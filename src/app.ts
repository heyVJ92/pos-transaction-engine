import "dotenv/config"; // first line of app.ts, before anything else
import express from "express";
import cors from "cors";
import env from "./config/env.js";
import { connectDB } from "./config/database.js";
import router from "./api/index.js"
const app = express();
app.use(cors({
    origin: process.env.UI_ORIGIN, // or array of allowed origins
    credentials: true
}));

// middlewares
app.use(express.json());
// health check — simplest possible for now
app.get("/health", (req, res) => {
    res.json({ success: true, message: "Server is running" });
});
app.use("/", router)

// global error handler — always last
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error(err.message);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: err.message } });
});

// start
await connectDB();

app.listen(env.PORT, () => {
    console.log(`✅ Server running on port ${env.PORT}`);
    console.log(`✅ Environment: ${env.NODE_ENV}`);
});