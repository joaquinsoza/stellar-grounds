import { Keypair } from "@stellar/stellar-sdk";

async function main() {
  const keypair = Keypair.random();
  console.log("🚀 « keypair:", keypair.publicKey());
  console.log("🚀 « keypair:", keypair.secret());
}

main();
