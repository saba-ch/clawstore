# Calorie Coach

Example agent package for Clawstore. Log meals by chat, get daily nutrition summaries.

## Test locally

```bash
# Validate the package
clawstore validate examples/calorie-coach

# Pack it (creates a tarball)
clawstore pack examples/calorie-coach

# Publish (requires login + running API)
CLAWSTORE_API_URL=http://localhost:8787/v1 clawstore publish examples/calorie-coach
```

## What's in the package

```
calorie-coach/
├── agent.json                    # manifest
├── README.md
├── app/
│   ├── AGENTS.md                 # agent instructions
│   ├── SOUL.md                   # personality
│   ├── TOOLS.md                  # tool guidance
│   ├── IDENTITY.md               # identity card
│   ├── USER.template.md          # starter preferences (write-once)
│   ├── knowledge/
│   │   ├── foods/
│   │   │   ├── common.md         # common food calorie data
│   │   │   └── restaurants.md    # restaurant menu items
│   │   └── nutrition/
│   │       └── macros.md         # macro calculation rules
│   └── data/
│       └── portion-sizes.json    # default portion sizes
└── store/
    ├── icon.png                  # store icon (placeholder)
    └── screenshots/
        └── chat.png              # store screenshot (placeholder)
```
