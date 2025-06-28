import {
  Address,
  Asset,
  Contract,
  Keypair,
  Networks,
  Operation,
  SorobanDataBuilder,
  TimeoutInfinite,
  TransactionBuilder,
  xdr,
} from "@stellar/stellar-sdk";
import { createToolkit, createTransactionBuilder, sendTransaction } from "soroban-toolkit";
import { config } from "dotenv";
config();

interface SoroswapAsset {
  name: string;
  code: string;
  issuer: string;
  contract: string;
  org: string;
  domain: string;
  icon: string;
  decimals: number;
}

const MAX_TRIES = 3;
const INITIAL_FEE = 100;

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

  const soroswapAssets = await fetch("https://raw.githubusercontent.com/soroswap/token-list/refs/heads/main/tokenList.json")
  const soroswapAssetsJson = await soroswapAssets.json()
  const soroswapAssetsArray: SoroswapAsset[] = soroswapAssetsJson.assets
  console.log("🚀 « soroswapAssetsArray:", soroswapAssetsArray.length, "assets found")

  const loaded = toolkit.getNetworkToolkit("mainnet");
  const keyPair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY!);
  const publicKey = keyPair.publicKey();

  // Check existing trustlines
  const { trustedAssets, untrustedAssets } = await checkTrustlines(loaded.horizonRpc, publicKey, soroswapAssetsArray);
  
  console.log('Trusted Assets: ', trustedAssets.length);
  console.log('Untrusted Assets: ', untrustedAssets.length);
  
  if (untrustedAssets.length === 0) {
    console.log('No new trustlines needed');
    return;
  }

  // Add trustlines for untrusted assets
  for (const asset of untrustedAssets) {
    await setTrustline(loaded.horizonRpc, keyPair, asset.code, asset.issuer);
  }
}

async function checkTrustlines(horizonRpc: any, publicKey: string, assets: SoroswapAsset[]) {
  const source = await horizonRpc.loadAccount(publicKey);
  const trustedAssets: SoroswapAsset[] = [];
  const untrustedAssets: SoroswapAsset[] = [];
  
  for (const asset of assets) {
    const trustlineExists = source.balances.some((balance: any) => {
      return (
        (balance.asset_type === 'credit_alphanum4' || 
         balance.asset_type === 'credit_alphanum12') &&
        balance.asset_code === asset.code &&
        balance.asset_issuer === asset.issuer
      );
    });
    
    if (!trustlineExists) {
      untrustedAssets.push(asset);
    } else {
      trustedAssets.push(asset);
    }
  }
  
  return { trustedAssets, untrustedAssets };
}

async function setTrustline(horizonRpc: any, keyPair: Keypair, tokenSymbol: string, tokenIssuer: string, tries: number = 1) {
  const source = await horizonRpc.loadAccount(keyPair.publicKey());
  
  const operation = Operation.changeTrust({
    source: source.accountId(),
    asset: new Asset(tokenSymbol, tokenIssuer),
  });
  
  const txn = new TransactionBuilder(source, {
    fee: (INITIAL_FEE * tries).toString(),
    timebounds: { minTime: 0, maxTime: 0 },
    networkPassphrase: Networks.PUBLIC,
  })
    .addOperation(operation)
    .setTimeout(TimeoutInfinite)
    .build();

  txn.sign(keyPair);

  try {
    const response = await horizonRpc.submitTransaction(txn);
    console.log('✅ Trustline set for ', tokenSymbol);
    return response;
  } catch (error) {
    if (tries < MAX_TRIES) {
      console.log('❌ Error trying to set trustline for ', tokenSymbol);
      console.log(error);
      console.log('🔄 Retrying...');
      await setTrustline(horizonRpc, keyPair, tokenSymbol, tokenIssuer, tries + 1);
    } else {
      console.log('🚫 Max tries reached for ', tokenSymbol, '. Unable to set trustline.');
      console.log(error);
    }
  }
}

main();
