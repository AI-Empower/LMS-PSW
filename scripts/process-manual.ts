// scripts/process-manual.ts
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
import fs from 'fs';
import pdf from 'pdf-parse';
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter';

// --- CONFIGURATION ---
// IMPORTANT: Use environment variables for these secrets. Do not hardcode them.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!; // Use the SERVICE key for server-side operations
const OPENAI_API_KEY = process.env.OPENAI_API_KEY!;
const PDF_PATH = '/Users/rohit/Documents/CanadaDreams/Mary.pdf'; // Update this path

// --- INITIALIZE CLIENTS ---
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

async function main() {
  console.log('--- Starting RAG Ingestion Process ---');

  // 1. Load and Parse the PDF
  console.log('Step 1: Loading and parsing the PDF...');
  const pdfData = fs.readFileSync(PDF_PATH);
  const parsedPdf = await pdf(pdfData);
  const documentText = parsedPdf.text;
  console.log(`Successfully parsed ${parsedPdf.numpages} pages.`);

  // 2. Split the Document into Chunks
  console.log('Step 2: Splitting document into chunks...');
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000, // The size of each chunk in characters
    chunkOverlap: 100, // The number of characters to overlap between chunks
  });
  const chunks = await splitter.createDocuments([documentText]);
  console.log(`Created ${chunks.length} chunks.`);

  // 3. Generate Embeddings and Insert into Supabase
  console.log('Step 3: Generating embeddings and inserting into Supabase...');
  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];

    // For now, metadata is simple. You can enhance this later to include chapter/section titles.
    const metadata = {
      pageContent: chunk.pageContent,
      page_number: chunk.metadata.loc?.pageNumber || 0
    };

    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: chunk.pageContent,
    });

    const embedding = embeddingResponse.data[0].embedding;

    const { error } = await supabase.from('psw_manual_chunks').insert({
      content: chunk.pageContent,
      metadata: metadata,
      embedding: embedding,
    });

    if (error) {
      console.error(`Error inserting chunk ${i}:`, error);
    } else {
      console.log(`Successfully inserted chunk ${i + 1}/${chunks.length}`);
    }
  }

  console.log('--- Ingestion Process Complete ---');
}

main().catch(console.error);
