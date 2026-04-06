import "dotenv/config";
import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import txRoutes from "./routes/tx";
import { config } from "./config";

const app = express();

app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // allow curl/postman/no-origin
      if (config.corsOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("CORS blocked: origin not allowed"));
    },
  })
);
app.use(express.json({ limit: "64kb" }));

app.use(
  rateLimit({
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
  })
);

app.use("/", txRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "rootstock-omni-key-relayer" });
});

app.listen(config.port, () => {
  console.log(`Relayer listening on http://localhost:${config.port}`);
  console.log(`  POST /relay - submit signed tx to Rootstock`);
  console.log(`  GET  /health - health check`);
});
