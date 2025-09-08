// tools/backfill-embeddings.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';
import readline from 'node:readline';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'aiempower-eb198';
const BUCKET = 'aiempower-embeddings-bucket';
const OBJECT = 'MaryOutput_embeddings_with_metadata.json'; // adjust if needed
const COLLECTION = 'manual_chunks_with_metadata';

// Concurrency & retry tuning
const MAX_IN_FLIGHT = 150;   // cap in-flight writes to reduce contention
const LOG_EVERY = 1000;      // progress logging cadence

function sleep(ms) {
    return new Promise(res => setTimeout(res, ms));
}

function shuffleInPlace(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = (Math.random() * (i + 1)) | 0;
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

async function main() {
    // Initialize Admin SDK with ADC
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });

    // ✅ IMPORTANT: Do NOT pass a settings object here
    const db = getFirestore(); // (default database "(default)")
    const storage = new Storage();

    // Read JSONL from GCS
    const file = storage.bucket(BUCKET).file(OBJECT);
    const stream = file.createReadStream();
    const rl = readline.createInterface({ input: stream, crlfDelay: Infinity });

    /** @type {{id:string, embedding:number[]}[]} */
    const records = [];
    let lineNo = 0;

    for await (const line of rl) {
        lineNo++;
        const trimmed = line.trim();
        if (!trimmed) continue;

        let rec;
        try {
            rec = JSON.parse(trimmed);
        } catch {
            console.warn(`Skipping invalid JSON at line ${lineNo}`);
            continue;
        }

        const id = rec?.id;
        const embedding = rec?.embedding;
        if (!id || !Array.isArray(embedding)) {
            console.warn(`Skipping record missing id/embedding at line ${lineNo}`);
            continue;
        }
        records.push({ id, embedding });
    }

    if (records.length === 0) {
        console.log('No records found to backfill. Exiting.');
        return;
    }

    // Shuffle to avoid key hotspots
    shuffleInPlace(records);

    const writer = db.bulkWriter();

    // Robust retry on ABORTED/contention
    writer.onWriteError(async (err) => {
        const maxAttempts = 10;
        if (err.failedAttempts < maxAttempts) {
            const base = 250; // ms
            const delay =
                Math.min(60000, Math.pow(1.8, err.failedAttempts) * base) +
                Math.floor(Math.random() * 300); // jitter
            console.warn(
                `Retrying ${err.documentRef.path} (attempt ${err.failedAttempts}) after ${delay}ms due to ${err.code || 'error'}`
            );
            await sleep(delay);
            return true;
        }
        console.error(
            `Permanent failure for ${err.documentRef.path} after ${err.failedAttempts} attempts:`,
            err.message
        );
        return false;
    });

    let updated = 0;
    let inFlight = new Set();

    async function gate() {
        while (inFlight.size >= MAX_IN_FLIGHT) {
            await Promise.race(inFlight);
        }
    }

    for (const { id, embedding } of records) {
        await gate();

        const p = writer
            .set(db.collection(COLLECTION).doc(id), { embedding }, { merge: true })
            .then(() => {
                inFlight.delete(p);
                updated++;
                if (updated % LOG_EVERY === 0) {
                    console.log(`Progress: ${updated}/${records.length} updated…`);
                }
            })
            .catch((e) => {
                inFlight.delete(p);
                console.error(`Failed write for ${id}:`, e?.message || e);
            });

        inFlight.add(p);
    }

    await Promise.allSettled([...inFlight]);
    await writer.close();

    console.log(`✅ Backfill done. Docs updated: ${updated} / ${records.length}`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});