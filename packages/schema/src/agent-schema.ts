// JSON Schema for agent.json manifest (schemaVersion: 1).
// This is the contract between package authors and the backend.

export const agentJsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  required: [
    "schemaVersion",
    "id",
    "version",
    "name",
    "tagline",
    "description",
    "category",
    "tags",
    "author",
    "license",
    "agent",
    "files",
    "openclaw",
  ],
  properties: {
    schemaVersion: {
      type: "integer",
      const: 1,
    },
    id: {
      type: "string",
      pattern: "^@[a-z0-9-]+/[a-z0-9][a-z0-9-]{0,62}[a-z0-9]$",
      description: "Scoped package ID: @scope/name",
    },
    version: {
      type: "string",
      pattern:
        "^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-((?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\\.(?:0|[1-9]\\d*|\\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\\+([0-9a-zA-Z-]+(?:\\.[0-9a-zA-Z-]+)*))?$",
      description: "SemVer version string",
    },
    name: {
      type: "string",
      minLength: 1,
      maxLength: 128,
    },
    tagline: {
      type: "string",
      minLength: 1,
      maxLength: 140,
    },
    description: {
      type: "string",
      minLength: 1,
    },
    category: {
      type: "string",
      minLength: 1,
    },
    tags: {
      type: "array",
      items: {
        type: "string",
        pattern: "^[a-z0-9-]+$",
        maxLength: 64,
      },
      maxItems: 20,
    },
    author: {
      type: "object",
      required: ["name"],
      properties: {
        name: { type: "string", minLength: 1 },
        url: { type: "string", format: "uri" },
      },
      additionalProperties: false,
    },
    license: {
      type: "string",
      minLength: 1,
    },
    homepage: {
      type: "string",
      format: "uri",
    },
    repository: {
      type: "string",
      format: "uri",
    },
    agent: {
      type: "object",
      required: ["defaults"],
      properties: {
        defaults: {
          type: "object",
          required: ["model"],
          properties: {
            model: { type: "string", minLength: 1 },
            thinking: { type: "string" },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    files: {
      type: "array",
      items: { type: "string", minLength: 1 },
      minItems: 1,
    },
    dependencies: {
      type: "object",
      properties: {
        plugins: {
          type: "array",
          items: {
            type: "object",
            required: ["spec", "required"],
            properties: {
              spec: { type: "string", minLength: 1 },
              required: { type: "boolean" },
              minVersion: { type: "string" },
            },
            additionalProperties: false,
          },
        },
        skills: {
          type: "array",
          items: {
            type: "object",
            required: ["slug", "required"],
            properties: {
              slug: { type: "string", minLength: 1 },
              required: { type: "boolean" },
            },
            additionalProperties: false,
          },
        },
        providers: {
          type: "object",
          properties: {
            any: {
              type: "array",
              items: { type: "string", minLength: 1 },
              minItems: 1,
            },
          },
          additionalProperties: false,
        },
      },
      additionalProperties: false,
    },
    setup: {
      type: "object",
      properties: {
        secrets: {
          type: "array",
          items: {
            type: "object",
            required: ["key", "prompt", "required", "target"],
            properties: {
              key: {
                type: "string",
                pattern: "^[A-Z][A-Z0-9_]*$",
              },
              prompt: { type: "string", minLength: 1 },
              required: { type: "boolean" },
              target: { type: "string", enum: ["env"] },
            },
            additionalProperties: false,
          },
        },
      },
      additionalProperties: false,
    },
    store: {
      type: "object",
      properties: {
        icon: { type: "string" },
        screenshots: {
          type: "array",
          items: { type: "string" },
        },
      },
      additionalProperties: false,
    },
    openclaw: {
      type: "object",
      required: ["entrypoints"],
      properties: {
        entrypoints: {
          type: "object",
          additionalProperties: { type: "string" },
        },
        templates: {
          type: "object",
          additionalProperties: { type: "string" },
        },
      },
      additionalProperties: false,
    },
  },
  additionalProperties: false,
} as const;
