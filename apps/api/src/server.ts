import { env } from "./lib/env.js";
import { createApp } from "./app.js";

const port = env.PORT;
const app = createApp();

app.listen(port, () => {
  console.log(`API listening on http://localhost:${port}`);
});
