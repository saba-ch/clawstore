export const SCHEMA_VERSION = 1;

// Agent manifest TypeScript types.
// Full JSON Schema implementation in Phase 4.

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
