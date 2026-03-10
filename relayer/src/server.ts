import "dotenv/config";
import express from "express";
import cors from "cors";
import txRoutes from "./routes/tx";
import { config } from "./config";

const app = express();

app.use(cors());
app.use(express.json({ limit: "64kb" }));

app.use("/", txRoutes);

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "rootstock-omni-key-relayer" });
});

app.listen(config.port, () => {
  console.log(`Relayer listening on http://localhost:${config.port}`);
  console.log(`  POST /relay - submit signed tx to Rootstock`);
  console.log(`  GET  /health - health check`);
});
