import { DEMO_MODE } from "@/lib/env";

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

  // Return the blob path, NOT the raw URL — use generateSasUrl for access
  return `${containerName}/${blobName}`;
}

/** Get the container/blob path from a stored reference */
export function getBlobPath(ref: string): { container: string; blob: string } {
  const firstSlash = ref.indexOf("/");
  return { container: ref.substring(0, firstSlash), blob: ref.substring(firstSlash + 1) };
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
 * Generate a short-lived SAS URL for temporary access (e.g., screening memos).
 * Default 15-minute expiry to limit exposure of confidential documents.
 */
export async function generateSasUrl(
  containerName: string,
  blobName: string,
  expiresInMinutes = 15
): Promise<string> {
  if (DEMO_MODE) return `https://demo.blob.core.windows.net/${containerName}/${blobName}?sas=demo`;

  const { BlobSASPermissions, generateBlobSASQueryParameters, StorageSharedKeyCredential } = require("@azure/storage-blob");
  const connectionString = process.env.AZURE_STORAGE_CONNECTION_STRING;
  if (!connectionString) throw new Error("AZURE_STORAGE_CONNECTION_STRING not set");

  // Parse account name and key from connection string
  const accountName = connectionString.match(/AccountName=([^;]+)/)?.[1];
  const accountKey = connectionString.match(/AccountKey=([^;]+)/)?.[1];
  if (!accountName || !accountKey) throw new Error("Cannot parse storage credentials");

  const credential = new StorageSharedKeyCredential(accountName, accountKey);
  const startsOn = new Date();
  const expiresOn = new Date(startsOn.getTime() + expiresInMinutes * 60 * 1000);

  const sasToken = generateBlobSASQueryParameters({
    containerName,
    blobName,
    permissions: BlobSASPermissions.parse("r"),
    startsOn,
    expiresOn,
  }, credential).toString();

  return `https://${accountName}.blob.core.windows.net/${containerName}/${blobName}?${sasToken}`;
}
