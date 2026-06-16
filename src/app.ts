import express from "express";
import env from "./config/env.js";
import { connectDB } from "./config/database.js";

const app = express();

// middlewares
app.use(express.json());

// routes — add as we build them
// app.use("/api/products", productRouter);
// app.use("/api/orders", orderRouter);

// health check — simplest possible for now
app.get("/health", (req, res) => {
    res.json({ success: true, message: "Server is running" });
});

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