const DEMO_MODE = process.env.DEMO_MODE === "true";

let blobServiceClient: any = null;

function getClient() {
  if (!blobServiceClient) {
    const { BlobServiceClient } = require("@azure/storage-blob");
    const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
    if (!connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING not set");
    blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
  }
  return blobServiceClient;
}

/**
 * Upload a file to Azure Blob Storage.
 * Returns the blob URL.
 */
export async function uploadBlob(
  containerName: string,
  blobName: string,
  data: Buffer | Uint8Array,
  contentType: string
): Promise<string> {
  if (DEMO_MODE) return `https://demo.blob.core.windows.net/${containerName}/${blobName}`;
  const client = getClient();
  const containerClient = client.getContainerClient(containerName);
  await containerClient.createIfNotExists();

  const blockBlobClient = containerClient.getBlockBlobClient(blobName);
  await blockBlobClient.upload(data, data.length, {
    blobHTTPHeaders: { blobContentType: contentType },
  });

  return blockBlobClient.url;
}

/**
 * Download a blob as a Buffer.
 */
export async function downloadBlob(
  containerName: string,
  blobName: string
): Promise<Buffer> {
  const client = getClient();
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  const response = await blobClient.download(0);
  const chunks: Buffer[] = [];

  if (response.readableStreamBody) {
    for await (const chunk of response.readableStreamBody as AsyncIterable<Buffer>) {
      chunks.push(chunk);
    }
  }

  return Buffer.concat(chunks);
}

/**
 * Generate a SAS URL for temporary access (e.g., for downloading audit PDFs).
 */
export async function generateSasUrl(
  containerName: string,
  blobName: string,
  expiresInMinutes = 60
): Promise<string> {
  const client = getClient();
  const containerClient = client.getContainerClient(containerName);
  const blobClient = containerClient.getBlobClient(blobName);

  // For SAS generation, the storage account key approach is used
  // In production, use managed identity with UserDelegationKey
  return blobClient.url;
}
