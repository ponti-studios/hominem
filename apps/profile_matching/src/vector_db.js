const {PineconeClient} = require('@pinecone-database/pinecone');

const pinecone = new PineconeClient();

const init = pinecone.init({
  environment: 'us-west4-gcp-free',
  apiKey: process.env.PINECONE_API_KEY,
});

async function upsertProfile(id, embedding) {
  await init;

  const index = pinecone.Index('sy-collab-profiles');

  const upsertRequest = {
    vectors: [
      {
        id: id,
        values: embedding,
      },
    ],
    namespace: 'sy-collab-profiles',
  };

  return await index.upsert({upsertRequest});
}

async function query(vector_query, limit) {
  await init;
  const index = pinecone.Index('sy-collab-profiles');

  const queryRequest = {
    vector: vector_query,
    topK: limit,
    includeValues: true,
    includeMetadata: true,
    namespace: 'sy-collab-profiles',
  };

  return await index.query({queryRequest});
}

module.exports = {
  upsertProfile,
  query,
};
