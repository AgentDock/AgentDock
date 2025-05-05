import { NodeRegistry } from '../node-registry';
import { AgentNode } from '../agent-node';
// Import the function but don't rely on side-effects from importing index
import { registerCoreNodes } from '../register-core-nodes'; 

// Assuming the main index file or an init function handles registration
// import '../index'; // This import should trigger the registration side effect - REMOVED

describe('Core Node Registration', () => {
  beforeAll(() => {
    // Explicitly register core nodes before running tests in this suite
    NodeRegistry.clear(); // Clear any previous state
    registerCoreNodes();
  });

  it('should register AgentNode after initialization', () => {
    // Check if the AgentNode type is registered
    expect(NodeRegistry.has('core.agent')).toBe(true);

    // Optional: Check if the registered class is indeed AgentNode
    // const registeredNode = NodeRegistry.get('core.agent');
    // expect(registeredNode?.nodeClass).toBe(AgentNode);
  });

  // Add similar tests for other core nodes expected to be registered by default
  // it('should have registered OtherCoreNode after initialization', () => { ... });
}); 