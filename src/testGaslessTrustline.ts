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

    const sponsorWallet = Keypair.random();
    const userWallet = Keypair.random()

    const toolkit = createToolkit({
      adminSecret: sponsorWallet.secret(),
      verbose: "full",
    });
  
    const server = toolkit.getNetworkToolkit("testnet");

    console.log("Sponsor wallet", sponsorWallet.publicKey())
    console.log("Sponsor wallet", sponsorWallet.secret())
    await server.horizonRpc.friendbot(sponsorWallet.publicKey()).call()
    console.log("User wallet", userWallet.publicKey())
    console.log("User wallet", userWallet.secret())
    await server.horizonRpc.friendbot(userWallet.publicKey()).call()
    console.log("Funding complete")

    const sponsorAccount = await server.horizonRpc.loadAccount(sponsorWallet.publicKey())
    const userAccount = await server.horizonRpc.loadAccount(userWallet.publicKey())

    console.log("Sponsor Balances:", sponsorAccount.balances)
    console.log("User Balances:", userAccount.balances)

    const XLM = Asset.native()
    const SAT1 = new Asset("SAT1", "GCNTYYJORSDB3RYWVCNCWK4U5SCCOOZKOXVUQZP6KCVRYLAP6TWWJ3C5")
    const SAT2 = new Asset("SAT2", "GCNTYYJORSDB3RYWVCNCWK4U5SCCOOZKOXVUQZP6KCVRYLAP6TWWJ3C5")

    const quoteRequest = {
      "assetIn": XLM.contractId(Networks.TESTNET), // USDC
      "assetOut": SAT1.contractId(Networks.TESTNET), // XLM
      "amount": "1000000000", // 100.0000000 USDC
      "tradeType": "EXACT_IN",
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

    const buildParams = {
      quote: quoteData,
      from: userWallet.publicKey(),
      to: userWallet.publicKey(),
      sponsor: sponsorWallet.publicKey()
    }

    const buildResponse = await fetch(`${process.env.API_URL}/quote/build?network=testnet`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(buildParams)
    });

    if (!buildResponse.ok) {
        throw new Error(`Swap request failed with status ${buildResponse.status}`);
    }

    const buildData = await buildResponse.json();
    console.log('Build Data:', buildData);

    const transaction = new Transaction(buildData.xdr, Networks.TESTNET);

    transaction.sign(sponsorWallet);
    transaction.sign(userWallet);

    const tx_hash = transaction.hash().toString("hex");
    console.log("🚀 | performSwap | tx_hash:", tx_hash)
    console.log({xdr: transaction.toXDR()})

    const sendResponse = await fetch(`${process.env.API_URL}/send?network=testnet`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({xdr: transaction.toXDR(), launchtube: false})
    });
    console.log("🚀 | performSwap | sendResponse:", sendResponse)

    const sponsor2Account = await server.horizonRpc.loadAccount(sponsorWallet.publicKey())
    const user2Account = await server.horizonRpc.loadAccount(userWallet.publicKey())

    console.log("Sponsor Balances:", sponsor2Account.balances)
    console.log("User Balances:", user2Account.balances)

    console.log("================================================")
    console.log("EXACT OUT")
    console.log("================================================")

    const quoteRequestOut = {
      "assetIn": SAT1.contractId(Networks.TESTNET), // USDC
      "assetOut": SAT2.contractId(Networks.TESTNET), // XLM
      "amount": "1000000000", // 100.0000000 USDC
      "tradeType": "EXACT_OUT",
      "protocols": ["sdex"], 
      "slippageTolerance": 50, // Optional
      "gaslessTrustline": true
    };
    console.log("🚀 | performSwap | quoteRequest:", quoteRequestOut)

    const quoteResponseOut = await fetch(`${process.env.API_URL}/quote?network=testnet`, {
      method: 'POST',
      headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
      },
      body: JSON.stringify(quoteRequestOut)
    });

    const quoteDataOut = await quoteResponseOut.json();
    console.log("🚀 | performSwap | quoteData:", quoteDataOut)

    const buildParamsOut = {
      quote: quoteDataOut,
      from: userWallet.publicKey(),
      to: userWallet.publicKey(),
      sponsor: sponsorWallet.publicKey()
    }

    const buildResponseOut = await fetch(`${process.env.API_URL}/quote/build?network=testnet`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(buildParamsOut)
    });

    if (!buildResponse.ok) {
        throw new Error(`Swap request failed with status ${buildResponse.status}`);
    }

    const buildDataOut = await buildResponseOut.json();
    console.log('Build Data:', buildDataOut);

    const transactionOut = new Transaction(buildDataOut.xdr, Networks.TESTNET);

    transactionOut.sign(sponsorWallet);
    transactionOut.sign(userWallet);

    const tx_hashOut = transactionOut.hash().toString("hex");
    console.log("🚀 | performSwap | tx_hash:", tx_hashOut)
    console.log({xdr: transactionOut.toXDR()})

    const sendResponseOut = await fetch(`${process.env.API_URL}/send?network=testnet`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({xdr: transactionOut.toXDR(), launchtube: false})
    });
    console.log("🚀 | performSwap | sendResponse:", sendResponseOut)

    const sponsor2AccountOut = await server.horizonRpc.loadAccount(sponsorWallet.publicKey())
    const user2AccountOut = await server.horizonRpc.loadAccount(userWallet.publicKey())

    console.log("Sponsor Balances:", sponsor2AccountOut.balances)
    console.log("User Balances:", user2AccountOut.balances)
  } catch (error) {
    console.error("Error:", error);
  }
}

// Replace these with your actual email and password
const email = process.env.API_EMAIL as string;
const password = process.env.API_PASSWORD as string;

// Execute the function
performSwap(email, password);
