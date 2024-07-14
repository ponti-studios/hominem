# SY Collab Profile Matching with Text Embeddings

A quick PoC to use OpenAI text embeddings to measure profile similarity for SY Collab profile users


## Step 1

Add your Open AI API Key as an env variable `OPENAI_API_KEY`. You can find your API key [here](https://platform.openai.com/account/api-keys)
   
       export OPENAI_API_KEY=...
   
## Step 2

Add your Pinecone API Key as an env variable `PINECONE_API_KEY`.  You can find your Pinecone API key [here](https://app.pinecone.io/organizations/-NWIbo1Zjw01ttb1KdXo/projects/us-west4-gcp-free:15218ec/keys)


    export PINECONE_API_KEY=...
    
## Step 3

Install dependencies

    npm install
   
 
 ## Step 4
 
Run the demo to update 1 profile, and find matches for it
 
     node main
     
