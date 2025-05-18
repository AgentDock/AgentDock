# Calorie Vision

Calorie Vision is an advanced AI-powered nutrition analysis agent designed to provide precise calorie and nutrient breakdowns from food images. Using cutting-edge visual recognition technology, it delivers comprehensive nutritional information with confidence and clarity.

## Key Features

- **Precise Food Identification**: Accurately identifies all visible food items in photographs with specific portions
- **Exact Calorie Calculation**: Provides specific calorie counts for individual items and total meals
- **Comprehensive Macronutrient Analysis**: Detailed breakdown of proteins, carbohydrates, and fats
- **Micronutrient Information**: Identifies key vitamins and minerals present in the meal
- **Improvement Suggestions**: Offers specific alternatives to enhance nutritional profile
- **Interactive Follow-up**: Asks relevant questions to help users achieve their nutrition goals
- **Professional Formatting**: Presents information in well-structured tables and clear sections
- **Confident Analysis**: Delivers information with authority and precision, not estimates

## Use Cases

Calorie Vision is ideal for:

- **Diet Tracking**: Get precise nutritional information without manual logging
- **Meal Planning**: Understand the nutritional profile of your prepared meals
- **Restaurant Dining**: Analyze the nutritional content of restaurant meals
- **Recipe Development**: Evaluate the nutritional value of your culinary creations
- **Nutritional Education**: Learn about the nutrient content of various foods
- **Fitness Goals**: Track macronutrient intake for athletic performance
- **Dietary Modifications**: Receive specific suggestions to improve nutritional content

## How It Works

Calorie Vision leverages the Gemini 2.0 Flash multimodal model to analyze food images with remarkable accuracy. The agent:

1. **Processes the image** to identify all food components with precise portions
2. **Calculates nutritional values** based on recognized items and visible portions
3. **Organizes the information** into a comprehensive, well-formatted report
4. **Suggests improvements** tailored to enhance the nutritional profile
5. **Engages with follow-up questions** to provide additional value

## Example Output

When analyzing a food image, Calorie Vision provides structured output like this:

```
## Food Identification

This meal contains: 1 slice of margherita pizza (8-inch diameter, 107g), 1 cup of garden salad (67g), and 1 breadstick (28g).

## Total Meal Calories: 478

## Calorie Breakdown

| Food Item | Calories | % of Total |
|-----------|----------|------------|
| Pizza Slice (107g) | 285 | 59.6% |
| Garden Salad (67g) | 33 | 6.9% |
| Breadstick (28g) | 160 | 33.5% |

## Macronutrients

| Nutrient | Amount | % of Calories |
|----------|--------|---------------|
| Protein | 16.2g | 13.5% |
| Carbohydrates | 58.4g | 48.9% |
| Fat | 20.1g | 37.6% |

## Micronutrients

Key micronutrients in this meal:
- Vitamin A: 22% DV
- Vitamin C: 15% DV
- Calcium: 25% DV
- Iron: 18% DV
- Sodium: 38% DV

## Suggestions for Improvement

1. **Replace the breadstick with a second cup of garden salad** to reduce calories by 127 while adding more fiber and vitamins.
2. **Add 3oz of grilled chicken (85g)** to the salad to increase protein content by 26g and improve satiety.
3. **Choose thin-crust pizza** instead of regular crust to reduce carbohydrates by approximately 12g per slice.
4. **Drizzle 1 tablespoon of olive oil (13.5g)** on the salad instead of creamy dressing to add healthy fats while reducing sodium.

## Follow-up Questions

1. Would you like suggestions for a completely plant-based version of this meal?
2. Are you looking to increase protein or reduce carbohydrates in your diet?
3. Would you like to know how this meal fits into different dietary approaches (keto, paleo, etc.)?
```

## Implementation

Calorie Vision is built on the Gemini 2.0 Flash model with:

- **Low Temperature Setting**: For consistent, precise outputs
- **Web Search Grounding**: To access up-to-date nutritional databases
- **Optimized Instructions**: To ensure confident, detailed analysis
- **Structured Format**: To provide consistent, easy-to-read results

## Tips for Best Results

For optimal analysis:

1. **Clear Images**: Provide clear, well-lit photos that show all food items
2. **Different Angles**: When possible, include images from multiple angles
3. **Size Reference**: Including standard items for size reference can help with portion estimation
4. **Full Plates**: Ensure all food items are visible in the image
5. **Ask Specific Questions**: You can ask about specific nutrients or dietary concerns
6. **Request Alternatives**: Ask for substitution ideas to meet specific dietary goals

## Limitations

While Calorie Vision strives for accuracy, users should be aware of these limitations:

- Analysis is based on visible characteristics, not laboratory testing
- Hidden ingredients or preparation methods may affect actual nutritional values
- Portion sizes are estimated based on visual cues
- Some regional or specialty dishes may have varying nutritional profiles

## Example Queries

- "1 slice of margherita pizza"
- "Bowl of ramen with pork"
- "2 sushi rolls - California and Spicy Tuna"
- "Half avocado toast with poached egg"
- "How can I make this meal higher in protein?"
- "What's a lower-carb alternative for this dish?"
- "How does this meal fit into a Mediterranean diet?"

Calorie Vision is your personal nutrition expert, providing detailed insights from simple food photos with confidence and precision.
