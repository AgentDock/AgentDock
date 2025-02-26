# Contributing to AgentDock RFAs

Thank you for your interest in contributing to AgentDock's Request For Agents (RFA) system! This document provides guidelines for creating and submitting new RFAs.

## Creating a New RFA

1. **Use the Template**: Copy `template.md` to create your RFA
2. **Follow the Format**: Fill in all required sections
3. **Name Your File**: Use the format `XXX-descriptive-name.md` where XXX is the next available number
4. **Include Required Metadata**:
   ```yaml
   ---
   id: XXX
   title: "Your Agent Title"
   tags: ["relevant", "tags", "here"]
   status: "open"
   ---
   ```

## RFA Quality Guidelines

1. **Problem Statement**
   - Clearly define the problem
   - Explain why an AI agent is a good solution
   - Include relevant context and constraints

2. **Architecture**
   - Use mermaid diagrams to show node connections
   - Explain each node's purpose
   - Follow AgentDock's node-based architecture

3. **Implementation Guide**
   - Provide clear node configurations
   - Include example code
   - Document all required connections

4. **Example Usage**
   - Show realistic conversation examples
   - Include edge cases if relevant
   - Demonstrate key features

## Submitting Your RFA

1. Fork the repository
2. Create a feature branch (`feat/add-rfa-xyz`)
3. Add your RFA file
4. Submit a PR with:
   - Clear description
   - Link to any related issues
   - Screenshots if relevant

## Review Process

1. RFAs are reviewed for:
   - Technical accuracy
   - Completeness
   - Clarity
   - Adherence to template
2. Feedback will be provided via PR comments
3. Updates may be requested before merging

## Questions?

If you have questions about creating an RFA, please:
1. Check existing RFAs for examples
2. Review the template documentation
3. Open a GitHub issue for clarification

Thank you for contributing to AgentDock! 