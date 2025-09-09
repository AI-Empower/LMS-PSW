// tools/rename-source-file.mjs
import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'aiempower-eb198';
const COLLECTION = 'manual_chunks_with_metadata';
const OLD_VALUE = 'MaryOutput.txt';
const NEW_VALUE = 'PSW By Mary J. Wilk';

// Tune for stability vs speed
const MAX_IN_FLIGHT = 150;   // reduce to 80 if you see contention
const LOG_EVERY = 1000;      // progress log cadence
const DRY_RUN = false;       // set true to preview only (no writes)

function sleep(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

async function main() {
    initializeApp({ credential: applicationDefault(), projectId: PROJECT_ID });
    const db = getFirestore();

    console.log(
        `Starting rename: source_file "${OLD_VALUE}" -> "${NEW_VALUE}" in "${COLLECTION}" (dryRun=${DRY_RUN})`
    );

    // Query only docs that need changing; project just minimal fields
    const snap = await db
        .collection(COLLECTION)
        .where('source_file', '==', OLD_VALUE)
        .select('source_file') // keep payload small
        .get();

    const total = snap.size;
    if (total === 0) {
        console.log('No documents match the OLD_VALUE. Nothing to do.');
        return;
    }
    console.log(`Matched ${total} documents.`);

    if (DRY_RUN) {
        // Print a few sample ids to confirm the selection looks right
        const sampleIds = snap.docs.slice(0, 10).map((d) => d.id);
        console.log('Sample doc IDs:', sampleIds);
        console.log('Dry run complete.');
        return;
    }

    // BulkWriter with robust retry on contention
    const writer = db.bulkWriter();
    writer.onWriteError(async (err) => {
        // Firestore "ABORTED" (code 10) indicates contention; back off & retry
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

    // Queue updates with throttling
    for (const doc of snap.docs) {
        await gate();
        const p = writer
            .update(doc.ref, { source_file: NEW_VALUE })
            .then(() => {
                inFlight.delete(p);
                updated++;
                if (updated % LOG_EVERY === 0) {
                    console.log(`Progress: ${updated}/${total} updated…`);
                }
            })
            .catch((e) => {
                inFlight.delete(p);
                console.error(`Failed update for ${doc.ref.path}:`, e?.message || e);
            });
        inFlight.add(p);
    }

    // Drain outstanding
    await Promise.allSettled([...inFlight]);
    await writer.close();

    console.log(`✅ Done. Updated ${updated} of ${total} matching documents.`);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});