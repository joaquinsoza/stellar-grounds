import { Keypair, Networks, rpc, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { config } from "dotenv";
config();

interface SwapRequest {
  assetIn: string;
  assetOut: string;
  amount: string;
  tradeType: string;
  slippageTolerance: string;
  protocols?: string[];
  parts?: number;
  maxHops?: number;
  assetList?: string[];
}

interface LoginResponse {
  access_token: string;
  refresh_token: string;
}

let accessToken: string;
let counter = 0;

// Asset pool for fuzzing
const ASSET_IDS = [
  "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
  "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75",
  // Add more asset IDs as needed
];

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function getRandomTradeType(): "EXACT_IN" | "EXACT_OUT" {
  return Math.random() < 0.5 ? "EXACT_IN" : "EXACT_OUT";
}

function getRandomAssets(): { assetIn: string, assetOut: string } {
  let idx1 = getRandomInt(0, ASSET_IDS.length - 1);
  let idx2;
  do {
    idx2 = getRandomInt(0, ASSET_IDS.length - 1);
  } while (idx2 === idx1);
  return { assetIn: ASSET_IDS[idx1], assetOut: ASSET_IDS[idx2] };
}

async function login(email: string, password: string): Promise<string> {
  if (accessToken) {
    return accessToken;
  }

  const loginResponse = await fetch("http://localhost:4000/login", {
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
  accessToken = data.access_token;
  return accessToken;
}

async function performSwap(
  email: string,
  password: string,
  stellarWallet: Keypair,
  assetIn: string,
  assetOut: string,
  amount: string,
  tradeType: "EXACT_IN" | "EXACT_OUT"
) {
  try {
    // First get the access token
    const accessToken = await login(email, password);
    console.log("Successfully logged in");

    console.log("Wallet:", stellarWallet.publicKey());

    // Fuzzed API call to /router/swap
    const swapRequest: SwapRequest = {
      assetIn,
      assetOut,
      amount,
      tradeType,
      protocols: ["soroswap", "phoenix", "aqua"],
      parts: 10,
      slippageTolerance: "100",
      maxHops: 1,
      assetList: ["soroswap"]
    }

    const swapResponse = await fetch("http://localhost:4000/router/swap/split?network=mainnet", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(swapRequest),
    });

    if (!swapResponse.ok) {
      throw new Error(`Swap request failed with status ${swapResponse.status}`);
    }

    const swapData = await swapResponse.json();

    console.log("Swap Response:", swapData.trade.distribution);

  } catch (error) {
    console.error("Error:", error);
  }
}

async function main() {
  const email = "dev@paltalabs.io";
  const password = "superuserpass";
  const stellarWallet = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY as string);

  // Fuzzing: randomize assetIn, assetOut, amount, and tradeType
  const { assetIn, assetOut } = getRandomAssets();
  const amount = getRandomInt(10000000, 1000000000000000).toString();
  const tradeType = getRandomTradeType();

  console.log("Number of retries", counter);
  console.log("=========================================================");
  console.log(`assetIn: ${assetIn}, assetOut: ${assetOut}, amount: ${amount}, tradeType: ${tradeType}`);
  await performSwap(email, password, stellarWallet, assetIn, assetOut, amount, tradeType);
  counter++;
  console.log("=========================================================");
}

const INTERVAL_MS = 2000; // 10 seconds

function startCountdown(intervalMs: number) {
  let remainingSeconds = Math.floor(intervalMs / 1000);
  const countdown = setInterval(() => {
    if (remainingSeconds > 0) {
      const hours = Math.floor(remainingSeconds / 3600);
      const minutes = Math.floor((remainingSeconds % 3600) / 60);
      const seconds = remainingSeconds % 60;
      let timeStr = '';
      if (hours > 0) timeStr += `${hours}h `;
      if (minutes > 0 || hours > 0) timeStr += `${minutes}m `;
      timeStr += `${seconds}s`;
      process.stdout.write(`\rNext job in: ${timeStr}   `);
      remainingSeconds--;
    } else {
      clearInterval(countdown);
      process.stdout.write('\n');
    }
  }, 1000);
  return countdown;
}

let countdown: NodeJS.Timeout;
const runWithCountdown = async () => {
  if (countdown) clearInterval(countdown);
  countdown = startCountdown(INTERVAL_MS);
  await main();
};
setInterval(runWithCountdown, INTERVAL_MS);
// Run immediately on start
runWithCountdown();