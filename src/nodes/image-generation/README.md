# Image Generation Tool

This tool provides image generation and editing capabilities using Google's Gemini 2.0 model. It allows agents to generate images from text descriptions or edit existing images based on text instructions.

## Capabilities

- **Text-to-Image Generation**: Create images from text descriptions
- **Image Editing**: Modify existing images based on text instructions
- **Multimodal Output**: Returns both generated image and text description
- **In-Memory Storage**: Generated images are stored and accessible via URL

## Usage

### Parameters

- `prompt` (required): Text description of the image to generate or edit
- `image` (optional): Base64 image data URL to edit (if provided, the tool will edit this image)

### Examples

#### Generating an image

```typescript
const result = await tools.generate_image.execute({
  prompt: 'A futuristic cityscape with flying cars and holographic billboards',
});
```

#### Editing an image

```typescript
const result = await tools.generate_image.execute({
  prompt: 'Make the sky blue and add birds flying in the background',
  image: 'data:image/jpeg;base64,/9j/4AAQSkZJRg...', // base64 image data
});
```

## Implementation Details

- Uses Google's Gemini 2.0 Flash experimental model
- Leverages the multimodal capabilities of Gemini for both inputs and outputs
- Returns the generated image as a URL (not a data URL)
- Includes any text description provided by the model
- Images are stored in memory with the AgentDock image store system

## API Configuration

The tool uses the GEMINI_API_KEY environment variable for authentication. For security:

1. Set the GEMINI_API_KEY in your .env file or environment variables
2. Unlike other LLM providers, the image generation tool always uses the environment variable, not agent-specific settings

Example in .env file:

```
GEMINI_API_KEY=your_api_key_here
```

## Output Format

The tool returns a structured result with:

```typescript
{
  url: string; // URL to access the generated image
  prompt: string; // The original prompt used for generation
  description: string | null; // Any descriptive text provided by the model
}
```

## Image Storage

Generated images are stored using the AgentDock image store system:

- Images are stored in-memory for the lifetime of the server
- Each image is assigned a unique ID for retrieval
- Images can be accessed via the `/api/images/store/[id]` endpoint
- This storage is suitable for development but should be replaced with a durable solution for production

## Limitations

- Maximum image size may be limited by API restrictions
- Complex edits may not always work as expected
- Image quality depends on the Gemini model's capabilities
- Currently does not support advanced parameters like image dimensions or style
- In-memory storage means images are lost when the server restarts
- Rate limits apply based on Google's Gemini API usage policies
- The API key must have permission to use the Gemini 2.0 Flash experimental model

## Future Enhancements

- Persistent storage for generated images
- Support for additional image generation parameters (size, style, etc.)
- Integration with other image generation models
- Image optimization and caching
