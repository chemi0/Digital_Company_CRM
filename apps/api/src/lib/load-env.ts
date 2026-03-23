import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirectory = path.dirname(currentFilePath);
const envPath = path.resolve(currentDirectory, "../../.env");

dotenv.config({ path: envPath });
