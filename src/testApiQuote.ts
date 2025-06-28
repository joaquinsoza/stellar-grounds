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

        // First API call to /router/swap
        // const swapRequest: SwapRequest = {
        //     "assetIn": "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA",
        //     "assetOut": "CBLLEW7HD2RWATVSMLAGWM4G3WCHSHDJ25ALP4DI6LULV5TU35N2CIZA",
        //     "amount": "40000000",
        //     "tradeType": "EXACT_IN",
        //     "protocols": ["soroswap", "phoenix", "aqua"],
        //     "parts": 10,
        //     "maxHops": 1,
        //     "slippageTolerance": "50",
        //     "assetList": ["soroswap"],
        //     "to": stellarWallet.publicKey(),
        //     "from": stellarWallet.publicKey()
        //   }
    

        const swapRequest: SwapRequest = {
            "assetIn": "CCW67TSZV3SSS2HXMBQ5JFGCKJNXKZM7UQUWUZPUTHXSTZLEO7SJMI75", // USDC
            "assetOut": "CAS3J7GYLGXMF6TDJBBYYSE3HQ6BBSMLNUQ34T6TZMYMW2EVH34XOWMA", // EURC
            "amount": "1000000", // 100.0000000 USDC
            "tradeType": "EXACT_IN",
            "protocols": ["soroswap", "aqua", "phoenix"], 
            "parts": 10, // Optional, the highest the better but may be slower
            "slippageTolerance": 50, // Optional
            "maxHops": 2, // Optional
            "assetList": ["soroswap"], // Optional
            "to": stellarWallet.publicKey(),
            "from": stellarWallet.publicKey()
        };

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

        console.log('XDR:', swapData.xdr);

        // Here we are using the rpc to send the transaction, but after signing we could send it through the /send endpoint
        // Now it should sign the transaction and send it to the network
        const server = new rpc.Server(process.env.SOROBAN_RPC as string);
        
        const transaction = new Transaction(swapData.xdr, Networks.PUBLIC);
        
        const simulationResponse = await server.simulateTransaction(transaction);
        console.log("🚀 | performSwap | simulationResponse:", simulationResponse)

        if (rpc.Api.isSimulationError(simulationResponse)) {
            throw Error(`Simulation error`);
        }
        
        const assembledTransaction = rpc.assembleTransaction(transaction, simulationResponse);
        const prepped_tx = assembledTransaction.build();
        prepped_tx.sign(stellarWallet);
        
        const tx_hash = prepped_tx.hash().toString("hex");
        console.log("🚀 | performSwap | tx_hash:", tx_hash)
        console.log({xdr: prepped_tx.toXDR()})

        const sendResponse = await fetch(`${process.env.API_URL}/send?network=mainnet`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({xdr: prepped_tx.toXDR()})
        });
        console.log("🚀 | performSwap | sendResponse:", sendResponse)

        // const response = await server.sendTransaction(prepped_tx);
        // console.log("🚀 | performSwap | response:", response)
        // const status = response.status;
        
        // let txResponse;
        // while (status === "PENDING") {
        //     await new Promise((resolve) => setTimeout(resolve, 2000));
        //     console.log("waiting for tx...");
        //     txResponse = await server.getTransaction(tx_hash);
        //     console.log("🚀 | performSwap | txResponse:", txResponse)

        //     if (txResponse.status === "SUCCESS") {
        //     console.log("Transaction successful");
        //     break;
        //     }
        // }
        // return txResponse;


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
