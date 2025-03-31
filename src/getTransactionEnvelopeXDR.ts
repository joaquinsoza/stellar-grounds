import {
  Address,
  Contract,
  Networks,
  Operation,
  SorobanDataBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { createToolkit, createTransactionBuilder, sendTransaction } from "soroban-toolkit";
import { config } from "dotenv";
config();

async function main() {
  const toolkit = createToolkit({
    adminSecret: process.env.STELLAR_SECRET_KEY!,
    customNetworks: [
      {
        network: "mainnet",
        horizonRpcUrl: process.env.HORIZON_RPC!,
        sorobanRpcUrl: process.env.SOROBAN_RPC!,
        networkPassphrase: Networks.PUBLIC,
      },
    ],
    verbose: "full",
  });

  const loaded = toolkit.getNetworkToolkit("mainnet");

  const txHash = "b1da7ca1c210eea48db8d00223c6024a01ee72ab2342d11bbb7fa90df856fda4";
  loaded.rpc.getTransaction(txHash).then((tx: any) => {
    console.log("Transaction Details:", tx.envelopeXdr.toXDR("base64"));
  });
}

main();
