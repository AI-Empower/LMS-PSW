// src/app/api/retrieve-psw-context/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore, DocumentReference } from 'firebase-admin/firestore';
import { v1 as aiplatform, helpers as aih } from '@google-cloud/aiplatform';

/**
 * ========================
 * Configuration
 * ========================
 */
const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'aiempower-eb198';
const LOCATION = process.env.VERTEX_LOCATION || 'us-central1';
const COLLECTION = 'manual_chunks_with_metadata';

// Retrieval + perf controls
const DEFAULT_SOURCE_FILE = 'PSW By Mary J. Wilk';
const DEFAULT_TOP_K = 5;
const MAX_TOP_K = 20;
const MAX_CANDIDATES = 800;         // tuned to keep fetch fast
const SIMILARITY_FLOOR = 0.60;      // try 0.50 if recall is low
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 min embeddings cache

type RetrieveBody = {
  query: string;
  topK?: number;
  sourceFile?: string;
};

/**
 * ========================
 * Singletons
 * ========================
 */
declare global {
  // eslint-disable-next-line no-var
  var __firebaseApp__: ReturnType<typeof initializeApp> | undefined;
  // eslint-disable-next-line no-var
  var __firestore__: ReturnType<typeof getFirestore> | undefined;
  // eslint-disable-next-line no-var
  var __vertexClient__: aiplatform.PredictionServiceClient | undefined;
}

if (!global.__firebaseApp__) {
  global.__firebaseApp__ = initializeApp({
    credential: applicationDefault(),
    projectId: PROJECT_ID,
  });
}
if (!global.__firestore__) {
  global.__firestore__ = getFirestore();
}
if (!global.__vertexClient__) {
  global.__vertexClient__ = new aiplatform.PredictionServiceClient({
    apiEndpoint: `${LOCATION}-aiplatform.googleapis.com`,
  });
}

const db = global.__firestore__;
const prediction = global.__vertexClient__;
const MODEL_ENDPOINT = `projects/${PROJECT_ID}/locations/${LOCATION}/publishers/google/models/text-embedding-005`;

/**
 * ========================
 * Utilities
 * ========================
 */
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  const len = Math.min(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const x = a[i], y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom ? dot / denom : 0;
}

async function embedQueryWithVertexAI(text: string): Promise<number[]> {
  const instances = [
    aih.toValue({ content: text, task_type: 'RETRIEVAL_QUERY' }),
  ] as any;
  const parameters = aih.toValue({ autoTruncate: false }) as any;

  const result = await prediction.predict({
    endpoint: MODEL_ENDPOINT,
    instances,
    parameters,
  });

  const resp: any = (result as any)[0];
  const firstPred = resp?.predictions?.[0];
  const obj = firstPred ? (aih.fromValue(firstPred) as any) : undefined;
  const values: unknown = obj?.embeddings?.values;
  if (!Array.isArray(values)) {
    throw new Error('Vertex AI did not return embedding values.');
  }
  return values.map((v: unknown) => Number(v));
}

/**
 * ========================
 * Embeddings Cache (per source_file)
 * ========================
 * We cache only {id, embedding} to keep memory reasonable.
 */
type EmbeddingEntry = { id: string; embedding: number[] };
const embeddingsCache: Record<string, { ts: number; list: EmbeddingEntry[] }> = {};

async function getEmbeddingsForFile(file: string): Promise<EmbeddingEntry[]> {
  const now = Date.now();
  const cached = embeddingsCache[file];
  if (cached && now - cached.ts < CACHE_TTL_MS) {
    return cached.list;
  }

  // Pass 1: fetch only id + embedding (small payload)
  const snap = await db
    .collection(COLLECTION)
    .where('source_file', '==', file)
    .select('embedding') // only embeddings; id comes from doc.id
    .limit(MAX_CANDIDATES)
    .get();

  const list: EmbeddingEntry[] = [];
  snap.forEach((doc) => {
    const d = doc.data() as any;
    if (!Array.isArray(d.embedding)) return;
    list.push({ id: doc.id, embedding: d.embedding as number[] });
  });

  embeddingsCache[file] = { ts: now, list };
  return list;
}

/**
 * Fetch details (content, page, etc.) for a small set of doc ids.
 * We avoid downloading embeddings again here.
 */
type DocDetail = {
  id: string;
  content: string;
  page_number?: number;
  chapter_title?: string;
  source_file?: string;
};

async function getDetailsForIds(ids: string[]): Promise<DocDetail[]> {
  if (ids.length === 0) return [];
  const refs: DocumentReference[] = ids.map((id) => db.collection(COLLECTION).doc(id));
  const docs = await db.getAll(...refs);

  const out: DocDetail[] = [];
  for (const d of docs) {
    if (!d.exists) continue;
    const data = d.data() as any;
    out.push({
      id: d.id,
      content: data?.content ?? '',
      page_number: data?.page_number,
      chapter_title: data?.chapter_title,
      source_file: data?.source_file,
    });
  }
  return out;
}

/**
 * ========================
 * API Handler (POST)
 * ========================
 */
export async function POST(req: NextRequest) {
  const t0 = Date.now();
  try {
    const body = (await req.json()) as RetrieveBody;
    if (!body?.query || typeof body.query !== 'string') {
      return NextResponse.json({ error: 'A string "query" is required.' }, { status: 400 });
    }
    const requestedTopK = body.topK ?? DEFAULT_TOP_K;
    const topK = Math.min(Math.max(requestedTopK, 1), MAX_TOP_K);

    const sourceFile = body.sourceFile ?? DEFAULT_SOURCE_FILE;

    // 1) Embed
    const tEmbed0 = Date.now();
    const qv = await embedQueryWithVertexAI(body.query);
    const tEmbed1 = Date.now();

    // 2) Get embeddings for this file (from cache or Firestore)
    const tFetch0 = Date.now();
    const candidates = await getEmbeddingsForFile(sourceFile);
    const tFetch1 = Date.now();

    // 3) Score and pick topK ids
    const tScore0 = Date.now();
    type Scored = { id: string; similarity: number };
    const scored: Scored[] = [];
    for (const c of candidates) {
      const sim = cosineSimilarity(qv, c.embedding);
      if (sim >= SIMILARITY_FLOOR) {
        scored.push({ id: c.id, similarity: sim });
      }
    }
    scored.sort((a, b) => b.similarity - a.similarity);
    const top = scored.slice(0, topK);
    const topIds = top.map((t) => t.id);
    const tScore1 = Date.now();

    // 4) Fetch details only for topK
    const tDetails0 = Date.now();
    const details = await getDetailsForIds(topIds);
    const detailsById = new Map(details.map((d) => [d.id, d]));
    const tDetails1 = Date.now();

    // 5) Build response
    const responseChunks = top.map((t) => {
      const d = detailsById.get(t.id);
      return {
        id: t.id,
        similarity: t.similarity,
        content: d?.content ?? '',
        page_number: d?.page_number,
        chapter_title: d?.chapter_title,
        source_file: d?.source_file,
      };
    });

    const context = responseChunks
      .map(
        (c) =>
          `Source ${c.source_file ?? ''} • Page ${c.page_number ?? 'N/A'} • sim=${c.similarity.toFixed(
            3
          )}\n"${c.content}"`
      )
      .join('\n\n---\n\n');

    // Timing log
    console.log(
      `[RAG] query="${body.query.slice(0, 64)}${body.query.length > 64 ? '…' : ''}" | file=${sourceFile} | topK=${topK} | timings(ms): embed=${tEmbed1 -
      tEmbed0}, fetchEmb=${tFetch1 - tFetch0}, score=${tScore1 - tScore0}, fetchDetails=${tDetails1 - tDetails0}, total=${Date.now() - t0} | candidates=${candidates.length} kept=${scored.length} cache=${embeddingsCache[sourceFile] ? 'hit' : 'miss'
      }`
    );

    return NextResponse.json({
      context,
      chunks: responseChunks,
      meta: {
        sourceFile,
        scanned: candidates.length,
        kept: scored.length,
        topK: responseChunks.length,
        similarityFloor: SIMILARITY_FLOOR,
        cache: embeddingsCache[sourceFile] ? 'hit' : 'miss',
      },
    });
  } catch (err: any) {
    console.error('[RAG] Error:', err);
    return NextResponse.json({ error: err.message ?? 'Internal error' }, { status: 500 });
  }
}

/**
 * ========================
 * Local Dev Notes
 * ========================
 * 1) Auth (ADC):
 *    gcloud config set project aiempower-eb198
 *    gcloud auth application-default login
 *    gcloud auth application-default set-quota-project aiempower-eb198
 *
 * 2) Env (.env.local):
 *    FIREBASE_PROJECT_ID=aiempower-eb198
 *    VERTEX_LOCATION=us-central1
 *
 * 3) Deps:
 *    npm i @google-cloud/aiplatform firebase-admin
 *
 * 4) Test:
 *    curl -sS http://localhost:3000/api/retrieve-psw-context \
 *      -H "Content-Type: application/json" \
 *      -d '{"query":"hand hygiene before feeding", "sourceFile":"MaryOutput.txt", "topK":5}'
 *
 * Notes:
 * - First request per file populates embeddings cache (slower once). Subsequent requests should be much faster.
 * - If you must support sourceFile=ALL, consider loading/caching all embeddings once at startup
 *   or migrating to a vector index (Vertex AI Vector Search) to avoid wide Firestore scans.
 */