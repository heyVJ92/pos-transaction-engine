import "dotenv/config"; // first line of app.ts, before anything else
import express from "express";
import cors from "cors";
import env from "./config/env.js";
import { connectDB } from "./config/database.js";
import router from "./api/index.js"
const app = express();

const allowedOrigins = env.ALLOWED_ORIGINS.split(",").map(origin => origin.trim());

app.use(cors({
    origin: (requestOrigin, callback) => {
    if(!requestOrigin) return callback(null, true);
    if(allowedOrigins.includes(requestOrigin)) return callback(null, true);
    else callback(new Error(`CORS: origin ${requestOrigin} not allowed!`));
    }, // or array of allowed origins
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
    console.log(err.stack);
    res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something Went Wrong" } });
});

// start
await connectDB();

app.listen(env.PORT, () => {
    console.log(`✅ Server running on port http://localhost:${env.PORT}`);
    console.log(`✅ Environment: ${env.NODE_ENV}`);
});