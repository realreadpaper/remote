import { AgentClient } from "./agentClient.js";
import { loadAgentConfig } from "./config.js";

const client = new AgentClient(loadAgentConfig());
client.connect();
