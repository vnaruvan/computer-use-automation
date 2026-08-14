import { loadEnvFile } from "node:process";
import OpenAI from "openai";

loadEnvFile();

const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL ?? "gpt-5-mini";

if (!apiKey) {
  throw new Error("OPENAI_API_KEY is missing from .env");
}

const client = new OpenAI({
  apiKey,
});

const response = await client.responses.create({
  model,
  input: "Reply with exactly MODEL_CONNECTION_OK",
});

console.log(response.output_text);