---
layout: default
title: Request For Agents (RFA)
---

# Request For Agents (RFA)

> Build powerful AI agents with AgentDock's node-based architecture

## What are Requests For Agents?

Requests For Agents (RFAs) are specifications for AI agents that solve real-world problems using the AgentDock framework. Each RFA provides a clear problem statement, implementation guidance using AgentDock's node system, and resources to help you build an effective agent.

```mermaid
graph TD
    A[Problem Statement] --> B[Agent Architecture]
    B --> C[Node Configuration]
    C --> D[Working Agent]
    
    style B fill:#e1f5fe,stroke:#81d4fa,stroke-width:2px
    style C fill:#e8f5e9,stroke:#a5d6a7,stroke-width:2px
```

## Browse RFAs

<div class="filters">
    <input type="text" id="search" placeholder="Search RFAs..." />
    
    <div class="tag-filters">
        {% assign all_tags = site.agents | map: "tags" | flatten | uniq | sort %}
        {% for tag in all_tags %}
        <label>
            <input type="checkbox" class="tag-filter" value="{{ tag }}" />
            {{ tag }}
        </label>
        {% endfor %}
    </div>
    
    <div class="status-filters">
        {% assign all_statuses = site.agents | map: "status" | uniq | sort %}
        {% for status in all_statuses %}
        <label>
            <input type="checkbox" class="status-filter" value="{{ status }}" />
            {{ status }}
        </label>
        {% endfor %}
    </div>
</div>

<div class="rfa-grid">
    {% for rfa in site.agents %}
    <div class="rfa-card">
        <h2><a href="{{ rfa.url | relative_url }}">{{ rfa.title }}</a></h2>
        <div class="description">{{ rfa.excerpt }}</div>
        <div class="rfa-meta">
            <span class="rfa-id">RFA-{{ rfa.id }}</span>
            <span class="rfa-status {{ rfa.status }}">{{ rfa.status }}</span>
            {% if rfa.bounty %}
            <span class="rfa-bounty">Has Bounty</span>
            {% endif %}
        </div>
        <div class="rfa-tags">
            {% for tag in rfa.tags %}
            <span class="tag">{{ tag }}</span>
            {% endfor %}
        </div>
    </div>
    {% endfor %}
</div>

## Why Build These Agents?

- **Solve Real Problems**: Each agent addresses actual user needs
- **Showcase Your Skills**: Implemented agents are featured in our showcase
- **Join Our Community**: Connect with other builders
- **Get Rewarded**: Selected implementations may receive special recognition
- **Build Your Portfolio**: Create valuable systems with real-world impact

## For Non-Developers

Not a developer? You can still create these agents without code using **AgentDock Pro** - our visual agent builder lets you implement any RFA through an intuitive drag-and-drop interface and natural language instructions.

[Learn more about AgentDock Pro →](https://agentdock.ai/pro) 