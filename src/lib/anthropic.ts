import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";

dotenv.config();

export const aopic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
