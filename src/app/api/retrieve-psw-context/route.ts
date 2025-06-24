// src/app/api/retrieve-psw-context/route.ts

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import { NextRequest, NextResponse } from 'next/server';

// --- INITIALIZATION ---
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!
});


// --- THE API HANDLER ---
export async function POST(req: NextRequest) {
  try {
    // 1. PARSE AND VALIDATE THE INCOMING REQUEST
    const { query } = await req.json();
    if (!query || typeof query !== 'string') {
      return NextResponse.json({ error: 'A string "query" is required.' }, { status: 400 });
    }
    console.log(`[RAG_API] Received query: "${query}"`);

    // 2. GENERATE EMBEDDING FOR THE QUERY
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query,
    });
    const queryEmbedding = embeddingResponse.data[0].embedding;
    console.log('[RAG_API] Generated query embedding.');

    // 3. QUERY THE DATABASE WITH THE FINAL, DATA-DRIVEN THRESHOLD
    // --- HIGHLIGHT: THIS IS THE FINAL, CORRECT VALUE ---
    // Based on diagnostic logs, a distance of < 0.40 (i.e., similarity > 0.60)
    // will capture the relevant chunks for this dataset.
    const { data: chunks, error } = await supabase.rpc('match_psw_chunks', {
      query_embedding: queryEmbedding,
      match_distance: 0.40, // Using the final, tuned production value.
      match_count: 5,       // Return the top 5 chunks.
    });

    if (error) {
      console.error('[RAG_API] Error from Supabase RPC:', error);
      return NextResponse.json({ error: 'Database query failed.' }, { status: 500 });
    }

    console.log(`[RAG_API] Retrieved ${chunks.length} relevant chunks.`);
    if (chunks && chunks.length > 0) {
      // This logging is still useful for observing performance.
      console.log('[RAG_API] Similarity scores:', chunks.map((c: any) => c.similarity));
    }

    // 4. FORMAT AND RETURN THE CONTEXT
    const context = chunks
      .map((chunk: any) => `Source from Page ${chunk.metadata.page_number}:\n"${chunk.content}"`)
      .join('\n\n---\n\n');

    return NextResponse.json({ context });

  } catch (e: any) {
    console.error('[RAG_API] An unexpected error occurred in the API route:', e);
    return NextResponse.json({ error: e.message || 'An unexpected error occurred.' }, { status: 500 });
  }
}