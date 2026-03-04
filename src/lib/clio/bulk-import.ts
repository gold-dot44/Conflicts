/**
 * CLI script for initial bulk import from Clio.
 * Run with: npm run clio:sync
 */
import { setClioTokens } from "./client";
import { bulkImportContacts, bulkImportMatters } from "./sync";

async function main() {
  console.log("Starting Clio bulk import...");

  // In production, tokens would come from a secure store
  // For initial setup, they're provided via environment variables
  setClioTokens({
    accessToken: process.env.CLIO_ACCESS_TOKEN!,
    refreshToken: process.env.CLIO_REFRESH_TOKEN!,
    expiresAt: Date.now() + 3600 * 1000,
  });

  console.log("Importing contacts...");
  const contactCount = await bulkImportContacts();
  console.log(`Imported ${contactCount} contacts.`);

  console.log("Importing matters...");
  const matterCount = await bulkImportMatters();
  console.log(`Imported ${matterCount} matters.`);

  console.log("Bulk import complete.");
  process.exit(0);
}

main().catch((err) => {
  console.error("Bulk import failed:", err);
  process.exit(1);
});
