import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';

// This is the TypeScript boilerplate for the development caching pattern.
declare global {
  // eslint-disable-next-line no-var
  var pswTutorAgentInstance: RealtimeAgent | undefined;
}

// The agent's instructions are now crucial for handling the RAG output.
const pswTutorInstructions = `
  You are a friendly and knowledgeable tutor for students studying to be a Personal Support Worker (PSW).
  Your tone is encouraging, patient, and clear.
  When the user asks a question about PSW topics, procedures, or definitions, you MUST use the 'get_psw_knowledge' tool to find the relevant information.
  After calling the tool, you will receive context which may include citations like "Source from Page X:".
  You must use this context to construct your answer. Synthesize the information from the different sources into a single, cohesive answer.
  Do NOT simply repeat the context back to the user along with page number and chapter.
  If the tool returns no relevant information (i.e., the context is empty), you MUST state that you couldn't find information on that specific topic in the provided material. Do not invent answers.
  For casual conversation (greetings, etc.), respond naturally without using the tool.
`;

// Define the tool's parameters using a Zod schema. This is correct.
const getPswKnowledgeParams = z.object({
  query: z.string().describe(
    "A detailed question or search query based on the user's message. This should be a full question to get the most relevant context."
  ),
});

// Define the tool itself.
const getPswKnowledgeTool = tool({
  name: 'get_psw_knowledge',
  description: 'Retrieves specific knowledge and text from the PSW course material to answer a user\'s question.',
  parameters: getPswKnowledgeParams,

  // --- HIGHLIGHT: THE FINAL, LIVE EXECUTE FUNCTION ---
  // This function now makes a real network call to your backend API.
  execute: async ({ query }) => {
    console.log(`[AGENT_TOOL] Calling RAG API with query: "${query}"`);
    try {
      // 1. Call the secure backend API route we built and tested.
      const response = await fetch('/api/retrieve-psw-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query }),
      });

      if (!response.ok) {
        throw new Error(`RAG API call failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log(`[AGENT_TOOL] Received context from RAG API.`);

      // 2. Return the retrieved context in the expected success format.
      // The agent will now receive the real content from your manual.
      return { success: true, context: data.context };

    } catch (error) {
      console.error('[AGENT_TOOL] Error calling RAG API:', error);
      return { success: false, error: 'Sorry, I had trouble looking that up in the manual.' };
    }
  },
});

// The Caching Pattern remains essential for development stability.
let pswTutorAgent: RealtimeAgent;

if (process.env.NODE_ENV === 'production') {
  pswTutorAgent = new RealtimeAgent({
    name: 'pswTutor',
    voice: 'sage',
    instructions: pswTutorInstructions,
    tools: [getPswKnowledgeTool],
    handoffs: [],
  });
} else {
  if (!global.pswTutorAgentInstance) {
    global.pswTutorAgentInstance = new RealtimeAgent({
      name: 'pswTutor',
      voice: 'sage',
      instructions: pswTutorInstructions,
      tools: [getPswKnowledgeTool],
      handoffs: [],
    });
  }
  pswTutorAgent = global.pswTutorAgentInstance;
}
// --- END OF CACHING LOGIC ---

export { pswTutorAgent };
export const pswTutorScenario = [pswTutorAgent];