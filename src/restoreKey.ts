import {
  Address,
  Networks,
  Operation,
  SorobanDataBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import {
  createToolkit,
  createTransactionBuilder,
  sendTransaction,
} from "soroban-toolkit";

async function main() {
  const toolkit = createToolkit({
    adminSecret: "<private-key>", // The one signing the transaction and paying for fees
    customNetworks: [
      {
        network: "mainnet",
        horizonRpcUrl: "horizon.stellar.org",
        sorobanRpcUrl: "<soroban-mainnet-rpc>",
        networkPassphrase: Networks.PUBLIC,
      },
    ],
    verbose: "full",
  });

  const loaded = toolkit.getNetworkToolkit("mainnet");

  const contractId = "<contractId>";

  const walletTarget = "<wallet-address-to-bump>"; // The wallet address that will be bumped in the contract

  // IMPORTANT! Construct the storage key for the expired balance
  const expiredBalanceKey = xdr.ScVal.scvVec([
    xdr.ScVal.scvSymbol("Balance"),
    new Address(walletTarget).toScVal(),
  ]);

  const contract = Address.fromString(contractId);

  // Construct the XDR for the specified storage key
  const storageKeyXDR = xdr.LedgerKey.contractData(
    new xdr.LedgerKeyContractData({
      contract: contract.toScAddress(),
      key: expiredBalanceKey,
      durability: xdr.ContractDataDurability.persistent(),
    })
  );

  // Bump the Data if the TTL is close to expire
  // const bumpTransactionData = new xdr.SorobanTransactionData({
  //   resources: new xdr.SorobanResources({
  //     footprint: new xdr.LedgerFootprint({
  //       readOnly: [storageKeyXDR],
  //       readWrite: [],
  //     }),
  //     instructions: 0,
  //     readBytes: 0,
  //     writeBytes: 0,
  //   }),
  //   resourceFee: xdr.Int64.fromString("0"),
  //   //@ts-ignore
  //   ext: new xdr.ExtensionPoint(0),
  // });

  // const tx = await createTransactionBuilder(loaded);
  // tx.addOperation(Operation.extendFootprintTtl({ extendTo: 3110400 - 1 }));
  // tx.setSorobanData(bumpTransactionData);

  // Restore the data if the TTL is expired
  const txBuilder = await createTransactionBuilder(loaded);
  txBuilder.addOperation(Operation.restoreFootprint({}));
  txBuilder.setSorobanData(
    new SorobanDataBuilder().setReadWrite([storageKeyXDR]).build()
  );

  const tx = txBuilder.build();

  const restul = await sendTransaction(loaded, tx, false);
  console.log("🚀 « restul:", restul);
}

main();
