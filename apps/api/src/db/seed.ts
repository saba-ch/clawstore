export const CATEGORIES = [
  { id: "productivity", name: "Productivity", icon: "briefcase", sortOrder: 1 },
  {
    id: "developer-tools",
    name: "Developer Tools",
    icon: "code",
    sortOrder: 2,
  },
  {
    id: "health-fitness",
    name: "Health & Fitness",
    icon: "heart",
    sortOrder: 3,
  },
  { id: "education", name: "Education", icon: "book", sortOrder: 4 },
  { id: "finance", name: "Finance", icon: "dollar", sortOrder: 5 },
  { id: "communication", name: "Communication", icon: "chat", sortOrder: 6 },
  { id: "entertainment", name: "Entertainment", icon: "play", sortOrder: 7 },
  { id: "writing", name: "Writing", icon: "pencil", sortOrder: 8 },
  { id: "research", name: "Research", icon: "search", sortOrder: 9 },
  {
    id: "data-analysis",
    name: "Data Analysis",
    icon: "chart",
    sortOrder: 10,
  },
  {
    id: "customer-support",
    name: "Customer Support",
    icon: "headset",
    sortOrder: 11,
  },
  { id: "other", name: "Other", icon: "box", sortOrder: 99 },
] as const;
