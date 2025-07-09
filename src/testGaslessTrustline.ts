import {
  Asset,
  Keypair,
  Networks,
  rpc,
  Transaction,
  TransactionBuilder,
} from "@stellar/stellar-sdk";
import { config } from "dotenv";
import { createToolkit } from "soroban-toolkit";
config();

interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

async function login(email: string, password: string): Promise<string> {
  const loginResponse = await fetch(`${process.env.API_URL}/login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
    }),
  });

  if (!loginResponse.ok) {
    throw new Error(`Login failed with status ${loginResponse.status}`);
  }

  const data: LoginResponse = await loginResponse.json();
  return data.access_token;
}

async function performSwap(email: string, password: string) {
  try {
    // First get the access token
    const accessToken = await login(email, password);
    console.log("Successfully logged in");

    // const sponsorWallet = Keypair.random();
    // const userWallet = Keypair.random()
    const sponsorWallet = Keypair.fromSecret("SBFCO23T7GQ4LC6XS3RWOCCZ2ZNFRBP5M66PNRXSORJNUA4DRQ2KBTQA")
    const userWallet = Keypair.fromSecret("SBILUWM3LOHUNZQKVBFRHU2VSYWTJCR526OCZZJ66KS6EMENZI6HUZDU")

    const toolkit = createToolkit({
      adminSecret: sponsorWallet.secret(),
      verbose: "full",
    });
  
    const server = toolkit.getNetworkToolkit("testnet");

    console.log("Sponsor wallet", sponsorWallet.publicKey())
    // await server.horizonRpc.friendbot(sponsorWallet.publicKey()).call()
    console.log("User wallet", userWallet.publicKey())
    // await server.horizonRpc.friendbot(userWallet.publicKey()).call()
    console.log("Funding complete")

    const sponsorAccount = await server.horizonRpc.loadAccount(sponsorWallet.publicKey())
    const userAccount = await server.horizonRpc.loadAccount(userWallet.publicKey())

    console.log("Sponsor Balances:", sponsorAccount.balances)
    console.log("User Balances:", userAccount.balances)

    const XLM = Asset.native()
    const USDC = new Asset("USDC", "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5")
    const EURC = new Asset("EURC", "GB3Q6QDZYTHWT7E5PVS3W7FUT5GVAFC5KSZFFLPU25GO7VTC3NM2ZTVO")

    const quoteRequest = {
      "assetIn": USDC.contractId(Networks.TESTNET), // USDC
      "assetOut": EURC.contractId(Networks.TESTNET), // XLM
      "amount": "5000000", // 100.0000000 USDC
      "tradeType": "EXACT_OUT",
      "protocols": ["sdex"], 
      "slippageTolerance": 50, // Optional
      "gaslessTrustline": true
    };
    console.log("🚀 | performSwap | quoteRequest:", quoteRequest)

    const quoteResponse = await fetch(`${process.env.API_URL}/quote?network=testnet`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(quoteRequest)
    });

    const quoteData = await quoteResponse.json();
    console.log("🚀 | performSwap | quoteData:", quoteData)


    // const buildParams = {
    //   quote: quoteData,
    //   from: userWallet.publicKey(),
    //   to: userWallet.publicKey(),
    //   sponsor: sponsorWallet.publicKey()
    // }

    // const buildResponse = await fetch(`${process.env.API_URL}/quote/build?network=testnet`, {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': `Bearer ${accessToken}`
    //     },
    //     body: JSON.stringify(buildParams)
    // });

    // if (!buildResponse.ok) {
    //     throw new Error(`Swap request failed with status ${buildResponse.status}`);
    // }

    // const buildData = await buildResponse.json();
    // console.log('Build Data:', buildData);

    // const transaction = new Transaction(buildData.xdr, Networks.TESTNET);

    // transaction.sign(sponsorWallet);
    // transaction.sign(userWallet);

    // const tx_hash = transaction.hash().toString("hex");
    // console.log("🚀 | performSwap | tx_hash:", tx_hash)
    // console.log({xdr: transaction.toXDR()})

    // const sendResponse = await fetch(`${process.env.API_URL}/send?network=testnet`, {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //         'Authorization': `Bearer ${accessToken}`
    //     },
    //     body: JSON.stringify({xdr: transaction.toXDR(), launchtube: false})
    // });
    // console.log("🚀 | performSwap | sendResponse:", sendResponse)
  } catch (error) {
    console.error("Error:", error);
  }
}

// Replace these with your actual email and password
const email = process.env.API_EMAIL as string;
const password = process.env.API_PASSWORD as string;

// Execute the function
performSwap(email, password);
