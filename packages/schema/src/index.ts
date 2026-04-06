import Ajv from "ajv";
import addFormats from "ajv-formats";
import { agentJsonSchema } from "./agent-schema.js";

export { agentJsonSchema } from "./agent-schema.js";

export const SCHEMA_VERSION = 1;

// Agent manifest TypeScript types.

export interface AgentManifest {
  schemaVersion: number;
  id: string;
  version: string;
  name: string;
  tagline: string;
  description: string;
  category: string;
  tags: string[];
  author: { name: string; url?: string };
  license: string;
  homepage?: string;
  repository?: string;
  agent: {
    defaults: {
      model: string;
      thinking?: string;
    };
  };
  files: string[];
  dependencies?: {
    plugins?: Array<{
      spec: string;
      required: boolean;
      minVersion?: string;
    }>;
    skills?: Array<{
      slug: string;
      required: boolean;
    }>;
    providers?: {
      any: string[];
    };
  };
  setup?: {
    secrets?: Array<{
      key: string;
      prompt: string;
      required: boolean;
      target: "env";
    }>;
  };
  store?: {
    icon?: string;
    screenshots?: string[];
  };
  openclaw: {
    entrypoints: Record<string, string>;
    templates?: Record<string, string>;
  };
}

// Compiled Ajv validator for agent.json schema validation.

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);

const compiledValidate = ajv.compile<AgentManifest>(agentJsonSchema);

export interface SchemaError {
  path: string;
  message: string;
}

/** Validate a parsed agent.json object against the JSON Schema. */
export function validateManifestSchema(data: unknown): {
  valid: boolean;
  errors: SchemaError[];
} {
  const valid = compiledValidate(data);
  if (valid) {
    return { valid: true, errors: [] };
  }

  const errors: SchemaError[] = (compiledValidate.errors ?? []).map((e) => ({
    path: e.instancePath || "/",
    message: e.message ?? "Unknown validation error",
  }));

  return { valid: false, errors };
}
