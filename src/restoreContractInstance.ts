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

  const contractId = "CBO4VL3JZJIC7H55DWSJ6NMKFVVNKTYOZO5QWHVXIQSZFLD5DRCJGYR2";
  const contractHash = "060d10e53779b685f6b2525fc6b1fb7f491601775a6f17fab319ac15e1e9c509";

  const contract = new Contract(contractId);
  const instance = contract.getFootprint();

  const ledgerKeyContractCode = xdr.LedgerKey.contractCode(
    new xdr.LedgerKeyContractCode({
      hash: Buffer.from(contractHash, "hex"),
    })
  );

  // Restore the data if the TTL is expired
  const txBuilder = await createTransactionBuilder(loaded);
  txBuilder.setSorobanData(
    new SorobanDataBuilder().setReadWrite([instance, ledgerKeyContractCode]).build()
  );
  txBuilder.addOperation(Operation.restoreFootprint({}));

  const tx = txBuilder.build();

  const result = await sendTransaction(loaded, tx, false);
  console.log("🚀 « result:", result);
}

main();
