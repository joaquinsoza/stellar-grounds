import {
  Networks,
  Operation,
  TransactionBuilder,
  Keypair,
} from "@stellar/stellar-sdk";
import { createToolkit, sendTransaction } from "soroban-toolkit";

async function main() {
  const toolkit = createToolkit({
    adminSecret: "<secret-key> ",
    customNetworks: [
      {
        network: "mainnet",
        horizonRpcUrl: "https://horizon.stellar.org",
        sorobanRpcUrl: "<soroban-rpc>",
        networkPassphrase: Networks.PUBLIC,
      },
    ],
    verbose: "full",
  });

  const loaded = toolkit.getNetworkToolkit("mainnet");

  console.log(`Merging account ${loaded.admin.publicKey()} into <account>...`);

  // TODO: Needs to remove all trustlines before merging

  try {
    // Load the account to be merged
    const account = await loaded.horizonRpc.loadAccount(
      loaded.admin.publicKey()
    );

    // Create the merge transaction
    const transaction = new TransactionBuilder(account, {
      fee: (await loaded.horizonRpc.fetchBaseFee()).toString(),
      networkPassphrase: loaded.passphrase,
    })
      .addOperation(
        Operation.accountMerge({
          destination: "<destination-address>",
        })
      )
      .setTimeout(500)
      .build();

    // Sign the transaction with the source account's keypair
    transaction.sign(loaded.admin);

    // // Submit the transaction
    const response = await loaded.horizonRpc.submitTransaction(transaction);

    console.log(`Account ${loaded.admin.publicKey()} merged successfully!`);
    console.log("Transaction Response:", response);
  } catch (error) {
    console.error(`Error merging account ${loaded.admin.publicKey()}:`, error);
  }
}

main().catch((error) => console.error("Error in main:", error));
