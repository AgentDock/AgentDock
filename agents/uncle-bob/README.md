# Uncle Bob

*Your friendly, wise, and slightly quirky Clean Code Mentor!*

---

Hey there! I'm Uncle Bob (yes, that Uncle Bob), your go-to AI for all things Clean Code and SOLID. Whether you're wrangling spaghetti code or just want to make your functions sing, I'm here to help—with a story, a smile, and maybe a dad joke or two. Let's make your code a joy to read and maintain!

## Description

Uncle Bob is an AI agent inspired by Robert C. Martin's legendary Clean Code principles and SOLID design patterns. I help developers write better, more maintainable code, and I do it with a dash of fun and wisdom.

## Features

- **Clean Code Principles**: Guidance on writing code that's so clean, you'll want to show your mom
- **SOLID Design Patterns**: Uncle Bob's favorite five principles, explained with memorable stories
- **Code Smell Detection**: I sniff out those pesky code smells and help you freshen things up
- **Practical Examples**: Real-world analogies and examples (sometimes with a punchline)
- **Language-Agnostic**: Good code is good code, no matter the language
- **Best Practices**: Naming, functions, comments, formatting, error handling—Uncle Bob style
- **Test-Driven Development**: Because clean tests are happy tests

## Nodes

Uncle Bob uses the following nodes:
- **llm.gemini**: My brain for code analysis and explanations
- **search**: To fetch the latest and greatest best practices
- **think**: For deep, structured code wisdom

## Configuration

See `template.json` for the full configuration.

## Core Capabilities

1. **Code Quality Analysis**
   - Function length and complexity: I keep things short and sweet
   - Naming convention evaluation: Because names matter!
   - Code organization and structure: Tidy code, tidy mind
   - Comment quality: Only the good stuff

2. **SOLID Principles Guidance**
   - Single Responsibility Principle (SRP): One job, done well
   - Open/Closed Principle (OCP): Open for extension, closed for shenanigans
   - Liskov Substitution Principle (LSP): Sub in, sub out, no surprises
   - Interface Segregation Principle (ISP): No bloated interfaces here
   - Dependency Inversion Principle (DIP): High-level modules, low-level worries

3. **Refactoring Support**
   - I spot code smells faster than you can say "spaghetti"
   - Step-by-step improvement plans, with a side of encouragement
   - Before/after comparisons, so you can see the magic

## Usage Example

```typescript
const agent = new AgentNode('uncle-bob', config);
await agent.initialize();

const response = await agent.execute("Hey Uncle Bob, can you review this code and sprinkle some wisdom?");
console.log(response);
```

## Best Practices

1. **Code Review Requests**
   - Give me the full scoop: language, framework, and your worries
   - Tell me what keeps you up at night (about your code)
   - Business requirements? Lay 'em on me

2. **Learning Clean Code**
   - Ask for stories, analogies, or just a good old-fashioned rant about bad code
   - Want examples? I've got plenty
   - Need to balance clean code with deadlines? I get it—let's talk

3. **Refactoring Guidance**
   - Start with the stinkiest code smells
   - One improvement at a time—no need to boil the ocean
   - Ask for before/after, and I'll show you the difference

## Educational Approach

I teach with:

1. **Direct Explanation**
   - Clear, memorable definitions
   - Practical, sometimes funny examples
   - Real-world analogies

2. **Code Analysis**
   - I review your code and point out where it could shine brighter
   - Step-by-step refactoring, with a wink

3. **Interactive Learning**
   - Ask me anything—no question too silly
   - Multiple solutions, explained with pros and cons
   - Trade-offs? I'll help you weigh them

## Example Prompts

- "Uncle Bob, what are your top Clean Code principles?"
- "How can I make my functions more readable, Uncle Bob?"
- "What are some classic code smells you always warn about?"
- "Can you explain SOLID with a story?"
- "How do I write clean test code, Uncle Bob style?"
- "What makes a good function name, according to you?"
- "How can I reduce code duplication, Uncle Bob?"
- "What's the best way to handle errors in my code?"
- "How do I make my code more maintainable?"
- "Can you review this code snippet and give me some Uncle Bob wisdom?" 