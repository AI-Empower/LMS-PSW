// src/agents/PSWTutor.ts
import { RealtimeAgent, tool } from '@openai/agents/realtime';
import { z } from 'zod';

declare global {
  // eslint-disable-next-line no-var
  var pswTutorAgentInstance: RealtimeAgent | undefined;
}

/**
 * Agent instructions:
 * - Always call the get_psw_knowledge tool for PSW questions.
 * - Use the returned context and sources to compose an answer.
 * - Include page numbers and chapter titles in citations.
 * - If nothing is found, state that and provide general guidance (clearly labeled).
 */
const pswTutorInstructions = `
You are a friendly, knowledgeable tutor for Personal Support Worker (PSW) students.
Use an encouraging, patient, and clear tone.

When the user asks a PSW-related question (procedures, definitions, practices, scenarios, etc.):
1) You MUST call the tool "get_psw_knowledge" with the user's query.
2) The tool returns:
   - "context": synthesized text from the PSW manual chunks.
   - "sources[]": supporting chunks with:
       • id
       • page_number
       • chapter_title
       • source_file
       • similarity
       • excerpt
3) Compose a cohesive answer using the returned information. Do NOT paste raw chunks.
4) Cite your sources clearly, e.g.:
   "Chapter: <chapter_title> • Page: <page_number> (<source_file>)"
   Include citations after paragraphs or in a short "References" section.
5) If no results are returned (empty "sources" or "context"), explicitly say you couldn't find it in the provided material, THEN provide "General guidance (not from the manual)".

For casual conversation (greetings, etc.) respond naturally without using the tool.
Keep answers concise, accurate, and well-structured.
`;

/**
 * IMPORTANT for OpenAI "structured outputs":
 * - All fields must be required.
 * - Use `.nullable()` (not `.optional()`) for fields you may omit via null.
 */
const getPswKnowledgeParams = z.object({
  query: z
    .string()
    .describe('The user’s PSW question. Provide the full question for best retrieval.'),
  sourceFile: z
    .string()
    .nullable()
    .describe('Required (nullable). File to constrain search, e.g., "MaryOutput.txt". Use null to search default.'),
  topK: z
    .number()
    .int()
    .min(1)
    .max(20)
    .nullable()
    .describe('Required (nullable). Number of top chunks to retrieve. Use null for default (5).'),
});

/**
 * Tool implementation:
 * - Calls your Next.js RAG route.
 * - Returns a synthesized context plus a structured `sources` list the agent can cite from.
 */
const getPswKnowledgeTool = tool({
  name: 'get_psw_knowledge',
  description:
    'Retrieves knowledge from the PSW manual and returns context plus structured sources with page numbers and chapter titles for citation.',
  parameters: getPswKnowledgeParams,

  execute: async ({ query, sourceFile, topK }) => {
    console.log(`[AGENT_TOOL] Calling RAG API with query: "${query}"`);

    try {
      // Normalize required-but-nullable fields
      const effectiveTopK = topK ?? 5;
      const effectiveSource = (sourceFile && sourceFile.trim()) || undefined;

      const body: Record<string, unknown> = {
        query,
        topK: effectiveTopK,
      };
      if (effectiveSource) body.sourceFile = effectiveSource;

      const response = await fetch('/api/retrieve-psw-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`RAG API call failed with status: ${response.status}`);
      }

      const data = await response.json();
      console.log('[AGENT_TOOL] RAG meta:', {
        scanned: data?.meta?.scanned,
        kept: data?.meta?.kept,
        topK: data?.meta?.topK,
        sourceFile: data?.meta?.sourceFile,
      });

      const sources =
        Array.isArray(data?.chunks) && data.chunks.length > 0
          ? data.chunks.map((c: any) => ({
            id: String(c.id ?? ''),
            page_number: typeof c.page_number === 'number' ? c.page_number : undefined,
            chapter_title: typeof c.chapter_title === 'string' ? c.chapter_title : '',
            source_file: typeof c.source_file === 'string' ? c.source_file : '',
            similarity: typeof c.similarity === 'number' ? c.similarity : undefined,
            excerpt:
              typeof c.content === 'string'
                ? c.content.length > 500
                  ? c.content.slice(0, 500) + '…'
                  : c.content
                : '',
          }))
          : [];

      return {
        success: true as const,
        context: typeof data?.context === 'string' ? data.context : '',
        sources,
        meta: data?.meta ?? {},
      };
    } catch (error) {
      console.error('[AGENT_TOOL] Error calling RAG API:', error);
      return {
        success: false as const,
        error:
          'Sorry, I had trouble looking that up in the manual. Please try rephrasing or narrowing the question.',
      };
    }
  },
});

/**
 * Agent instantiation with dev-time singleton.
 */
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

export { pswTutorAgent };
export const pswTutorScenario = [pswTutorAgent];