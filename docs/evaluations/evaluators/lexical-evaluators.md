# Lexical Evaluator Suite

The AgentDock Evaluation Framework includes a suite of **Lexical Evaluators** designed for fast, deterministic, and cost-effective analysis of textual content. These evaluators operate directly on the text of agent responses or other inputs, without relying on complex NLP models or LLMs. Practical experience shows that these kinds of checks are invaluable for quick feedback loops and for validating basic textual properties before engaging more resource-intensive evaluations.

They are particularly useful for:

- Quick sanity checks on output format and content.
- Identifying the presence or absence of specific terms.
- Basic sentiment and toxicity screening.
- Measuring superficial textual similarity.

While they don't capture deep semantic meaning, they provide a crucial layer of assessment for many common requirements.

## Evaluators in this Suite

This suite currently comprises the following evaluators. Each has its own detailed documentation page:

- [Lexical Similarity Evaluator](./lexical-similarity.md):

  - Compares string similarity using various algorithms (e.g., Levenshtein, Jaro-Winkler).
  - Useful for checking how closely a response matches an expected template or a piece of known text, without requiring exact matches.

- [Keyword Coverage Evaluator](./keyword-coverage.md):

  - Checks for the presence, frequency, or coverage of specified keywords or phrases within the text.
  - Helpful for ensuring key information is included or for flagging forbidden terms (though `ToxicityEvaluator` is more specialized for the latter).

- [Sentiment Evaluator](./sentiment.md):

  - Analyzes the sentiment of the text, typically classifying it as positive, negative, or neutral.
  - Useful for gauging the emotional tone of an agent's response.

- [Toxicity Evaluator](./toxicity.md):
  - Scans text for predefined toxic terms or patterns from a blocklist.
  - A basic but important check for safety and appropriateness.

These evaluators can be used individually or in combination to build a comprehensive picture of an agent's textual output characteristics.
