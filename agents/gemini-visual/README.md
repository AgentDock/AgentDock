# Gemini Visual Creator

A specialized Gemini agent for generating highly detailed, descriptive images based on text prompts.

## Description

This agent leverages Google's Gemini model to create visually stunning, detailed images from user descriptions. It focuses on generating images immediately on the first prompt, then helping users refine their descriptions for even better results in subsequent iterations.

## Features

- **Immediate Generation**: Creates images directly from your first prompt without delay
- **Image Editing**: Modify existing images based on text instructions
- **Progressive Refinement**: Offers suggestions for improvements after initial generation
- **Detail-Oriented**: Specialized in producing highly detailed, descriptive visuals

## Configuration

The agent uses the following configuration:

- **Model**: gemini-2.0-flash-exp
- **Search Grounding**: Disabled (relies on built-in knowledge)
- **Temperature**: 0.7 (balanced creativity and coherence)
- **Nodes**: 
  - `llm.gemini`: Core language model capabilities
  - `generate_image`: Image creation and editing tool

### API Key Setup

To use this agent, you need to set up a Gemini API key:

1. Get your API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add it to your environment variables:
   - Create or edit your `.env.local` file in the project root
   - Add the line: `GEMINI_API_KEY=your_key_here`
3. Restart the development server if it's already running

**Note**: Never commit your API key to version control. The `.env.local` file is already included in `.gitignore`.

## Usage Examples

### Creating a New Image

```
User: "Create an image of a forest"
Agent: [Generates forest image immediately]
"I've created an image of a forest for you. If you'd like to enhance it further, I could add more details such as:
- A sunrise filtering through the trees
- A small stream running through the forest
- Autumn colors with fallen leaves
- Wildlife like deer or birds
Would you like me to modify the image with any of these elements?"
```

### Editing an Image

```
User: "Can you make the sky more dramatic in this image?"
Agent: "I'd be happy to edit this image to make the sky more dramatic. To get the best results, could you specify what type of dramatic sky you're looking for? For example:
- Stormy with dark clouds?
- Sunset with vibrant colors?
- Otherworldly with unusual phenomena?
- More stars or celestial objects visible?"
```

> **IMPORTANT**: To edit an image, you must first generate an image in chat, then click the **Edit** button (pencil icon) that appears when hovering over the image. This will take you to the dedicated image generation page with your image preloaded.
> 
> **Do not** attempt to edit images by uploading attachments directly in the chat - this will not work correctly due to limitations with the AI SDK streaming. Always use the Edit button to navigate to the dedicated page for proper image editing.
> 
> The dedicated image generation page provides the optimal environment for editing images with complete functionality.

## Best Practices

1. **Start Simple**: Begin with a basic prompt - the agent will generate an image immediately
2. **Refine Iteratively**: After seeing the first image, use the agent's suggestions to refine it
3. **Be Specific**: For second-generation images, provide as many details as possible
4. **Use the Edit Button**: Always use the edit button to modify images in the dedicated page

## Notes

- The agent does not use web search - it relies on built-in knowledge
- Image generation is powered by Google's Gemini model
- The agent will generate an image from your first prompt and then help refine it
- While the agent can read text content, its primary focus is visual creation 