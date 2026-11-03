export const samples = [
  {
    id: "user-profile",
    label: "User profile",
    description: "Personal details, preferences and tags.",
    left: {
      id: 1042,
      profile: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "engineer",
        location: "London"
      },
      preferences: {
        theme: "dark",
        notifications: true,
        language: "en"
      },
      tags: ["mathematics", "computing"],
      lastLogin: "2026-04-12T09:14:00Z"
    },
    right: {
      id: 1042,
      profile: {
        name: "Ada Lovelace",
        email: "ada@example.com",
        role: "admin",
        timezone: "Europe/London"
      },
      preferences: {
        theme: "dark",
        notifications: false,
        language: "en"
      },
      tags: ["computing", "history"],
      lastLogin: "2026-04-19T07:42:00Z"
    }
  },
  {
    id: "api-response",
    label: "API response",
    description: "Pagination, records and response metadata.",
    left: {
      status: "ok",
      requestId: "req_8f21",
      pagination: { page: 1, perPage: 20, total: 42 },
      data: [
        { id: 1, name: "Widget", price: 19.99, inStock: true },
        { id: 2, name: "Gadget", price: 34.5, inStock: false }
      ],
      meta: { cached: false, source: "db" }
    },
    right: {
      status: "ok",
      requestId: "req_8f21",
      pagination: { page: 2, perPage: 20, total: 44 },
      data: [
        { id: 1, name: "Widget", price: 17.99, inStock: true },
        { id: 2, name: "Gadget Pro", price: 39, inStock: true },
        { id: 3, name: "Adapter", price: 12.5, inStock: true }
      ],
      meta: { cached: true, generatedAt: "2026-05-01T12:00:00Z" }
    }
  },
  {
    id: "product-catalogue",
    label: "Product catalogue",
    description: "Nested products, prices and variants.",
    left: {
      catalogue: "spring-2026",
      products: [
        {
          sku: "KB-01",
          name: "Mechanical Keyboard",
          price: { amount: 129, currency: "USD" },
          variants: [
            { color: "black", stock: 12 },
            { color: "white", stock: 4 }
          ]
        },
        {
          sku: "MS-02",
          name: "Precision Mouse",
          price: { amount: 79, currency: "USD" },
          variants: [{ color: "graphite", stock: 31 }]
        }
      ],
      updatedAt: "2026-03-14T10:00:00Z"
    },
    right: {
      catalogue: "spring-2026",
      products: [
        {
          sku: "KB-01",
          name: "Mechanical Keyboard",
          price: { amount: 119, currency: "USD" },
          variants: [
            { color: "black", stock: 8 },
            { color: "white", stock: 6 },
            { color: "blue", stock: 0 }
          ]
        },
        {
          sku: "CB-03",
          name: "USB-C Hub",
          price: { amount: 59, currency: "USD" },
          variants: [{ color: "silver", stock: 18 }]
        }
      ],
      updatedAt: "2026-03-28T15:30:00Z"
    }
  },
  {
    id: "configuration",
    label: "Configuration file",
    description: "Application settings and feature flags.",
    left: {
      app: {
        name: "atlas",
        environment: "production",
        debug: false,
        region: "eu-west-1"
      },
      server: { host: "0.0.0.0", port: 8080, timeout: 30 },
      features: { darkMode: true, betaSearch: false, newDashboard: false },
      logging: { level: "info", targets: ["stdout"] },
      deprecated: { legacyApi: true }
    },
    right: {
      app: {
        name: "atlas",
        environment: "staging",
        debug: true,
        region: "eu-central-1"
      },
      server: { host: "0.0.0.0", port: 8443, timeout: 45 },
      features: { darkMode: true, betaSearch: true, newDashboard: false },
      logging: { level: "debug", targets: ["stdout", "file"] },
      maintenanceMode: false
    }
  },
  {
    id: "edge-cases",
    label: "Nested objects & edge cases",
    description: "Null versus missing, empty containers, Unicode and special keys.",
    left: {
      orderId: "ORD-2026-0042",
      customer: {
        name: "Renée O'Neil",
        email: "renee+orders@example.com",
        address: {
          city: "Zürich",
          country: "CH",
          postalCode: null
        }
      },
      "delivery.window": "09:00-17:00",
      items: [
        { sku: "A-1", quantity: 2, notes: null },
        { sku: "B-2", quantity: 1 }
      ],
      metadata: {},
      flags: [],
      total: 149.5
    },
    right: {
      orderId: "ORD-2026-0042",
      customer: {
        name: "Renée O'Neil",
        email: "renee@example.com",
        address: {
          city: "Zürich",
          country: "CH",
          postalCode: "8001",
          street: "Bahnhofstrasse 1"
        }
      },
      "delivery.window": "10:00-18:00",
      items: [
        { sku: "A-1", quantity: 3 },
        { sku: "B-2", quantity: 1, notes: null }
      ],
      metadata: {},
      flags: ["priority"],
      total: 149.5
    }
  }
];

export function getSample(id) {
  return samples.find(sample => sample.id === id) || null;
}
