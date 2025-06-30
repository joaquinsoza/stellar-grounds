import { Keypair, Networks, rpc, Transaction, TransactionBuilder } from "@stellar/stellar-sdk";
import { config } from "dotenv";
config();

interface SwapRequest {
    assetIn: string;
    assetOut: string;
    amount: string;
    tradeType: string;
    slippageTolerance: string | number;
    protocols?: string[];
    parts?: number;
    maxHops?: number;
    assetList?: string[];
    to?: string;
    from?: string;
    feeBps?: number;
}

interface LoginResponse {
    access_token: string;
    refresh_token: string;
}

async function login(email: string, password: string): Promise<string> {
    const loginResponse = await fetch(`${process.env.API_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            email,
            password
        })
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
        console.log('Successfully logged in');

        console.log("Wallet:", stellarWallet.publicKey());

        const swapRequest: SwapRequest = {
            "assetIn": "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75", // USDC
            "assetOut": "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA", // EURC
            "amount": "10000000", // 100.0000000 USDC
            "tradeType": "EXACT_IN",
            "protocols": ["soroswap", "aqua", "phoenix"], 
            "parts": 10, // Optional, the highest the better but may be slower
            "slippageTolerance": 50, // Optional
            "maxHops": 2, // Optional
            "assetList": ["soroswap"],
            "feeBps": 50
        }

        const swapResponse = await fetch(`${process.env.API_URL}/quote?network=mainnet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(swapRequest)
        });

        if (!swapResponse.ok) {
            throw new Error(`Swap request failed with status ${swapResponse.status}`);
        }

        const swapData = await swapResponse.json();
        console.log('Swap Response:', JSON.stringify(swapData, null, 2));

        const buildParams = {
            quote: swapData, 
            referralId: stellarWallet.publicKey(),
            to: stellarWallet.publicKey(), 
            from: stellarWallet.publicKey()
        }
        console.log("🚀 | performSwap | buildParams:", buildParams)
        
        const buildResponse = await fetch(`${process.env.API_URL}/quote/build?network=mainnet`, {
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
        console.log('Build Data:', JSON.stringify(buildData, null, 2));

        const transaction = new Transaction(buildData.xdr, Networks.PUBLIC);
        
        transaction.sign(stellarWallet);
        
        const tx_hash = transaction.hash().toString("hex");
        console.log("🚀 | performSwap | tx_hash:", tx_hash)
        console.log({xdr: transaction.toXDR()})

        const sendResponse = await fetch(`${process.env.API_URL}/send?network=mainnet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({xdr: transaction.toXDR(), launchtube: false})
        });
        console.log("🚀 | performSwap | sendResponse:", sendResponse)

    } catch (error) {
        console.error('Error:', error);
    }
}

// Replace these with your actual email and password
const email = process.env.API_EMAIL as string;
const password = process.env.API_PASSWORD as string;
const stellarWallet = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY as string);
// Execute the function
performSwap(email, password);
