from google.cloud import firestore

# Initialize Firestore client
db = firestore.Client()

# Your source file name used during upload
source_file = "MaryOutput.txt"

# Query Firestore
docs = db.collection("manual_chunks_with_metadata").where("source_file", "==", source_file).stream()

count = 0
for doc in docs:
    count += 1

print(f"✅ Total Firestore chunks for '{source_file}': {count}")
