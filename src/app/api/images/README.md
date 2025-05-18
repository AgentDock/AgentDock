# Image Generation and Storage API

The `/api/images` directory contains endpoints for image generation and storage in AgentDock.

## Directory Structure

```
/api/images/
├── gemini/                # Google Gemini image generation API
│   ├── actions.ts         # Server actions for Gemini image generation
│   └── route.ts           # API endpoint for Gemini image generation
└── store/                 # Image storage API
    ├── [id]/              # Get a specific image by ID
    │   └── route.ts       # API endpoint to retrieve an image by ID
    └── debug/             # Debug endpoint for image store
        └── route.ts       # API endpoint to list all stored images
```

## Endpoints

### Image Generation

- **POST /api/images/gemini**
  - Generates an image using Google's Gemini 2.0 API
  - Request body: `{ prompt: string, image?: string }`
  - Response: `{ image: string, description: string | null }`

### Image Storage

- **GET /api/images/store/[id]**

  - Retrieves an image by its ID
  - Response: Image binary data with appropriate Content-Type header

- **GET /api/images/store/debug**
  - Lists all stored images with metadata
  - Response: `{ count: number, images: Image[] }`

## Implementation Details

Images are stored in-memory using a global variable that persists for the lifetime of the server. This approach works well for development but would need to be replaced with a more durable storage solution (like a database or cloud storage) for production use.
