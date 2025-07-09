import {
  Asset,
  Keypair,
  TransactionBuilder,
  Operation,
  LiquidityPoolAsset,
  getLiquidityPoolId,
  BASE_FEE,
  Networks,
} from "@stellar/stellar-sdk";
import { config } from "dotenv";
import { createToolkit } from "soroban-toolkit";
config();

async function createAssetsAndAddLiquidity() {
  try {
    const liquidityProviderWallet = Keypair.random();

    const toolkit = createToolkit({
      adminSecret: liquidityProviderWallet.secret(),
      verbose: "full",
    });
  
    const server = toolkit.getNetworkToolkit("testnet").horizonRpc;

    console.log("LiquidityProvider Wallet Public Key:", liquidityProviderWallet.publicKey())
    console.log("LiquidityProvider Wallet Secret:", liquidityProviderWallet.secret())
    
    // Fund the account with friendbot
    console.log("Funding account with friendbot...");
    await server.friendbot(liquidityProviderWallet.publicKey()).call()

    let liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey())
    console.log("Initial LiquidityProvider Balances:", liquidityProviderAccount.balances)

    // Create the assets
    const XLM = Asset.native()
    const SAT1 = new Asset("SAT1", liquidityProviderWallet.publicKey())
    const SAT2 = new Asset("SAT2", liquidityProviderWallet.publicKey())

    console.log("Creating trustlines and issuing assets...");

    // Since the liquidity provider is also the issuer, we need to create trustlines to ourselves
    // But first, let's create a recipient account to hold some tokens
    const recipientWallet = Keypair.random();
    await server.friendbot(recipientWallet.publicKey()).call();

    // Create trustlines from recipient to our assets
    let recipientAccount = await server.loadAccount(recipientWallet.publicKey());
    
    const trustlineTransaction = new TransactionBuilder(recipientAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.changeTrust({
      asset: SAT1,
    }))
    .addOperation(Operation.changeTrust({
      asset: SAT2,
    }))
    .setTimeout(30)
    .build();

    trustlineTransaction.sign(recipientWallet);
    await server.submitTransaction(trustlineTransaction);
    console.log("Trustlines created successfully");

    // Issue tokens to the recipient account
    liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey());
    
    const issueTransaction = new TransactionBuilder(liquidityProviderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.payment({
      destination: recipientWallet.publicKey(),
      asset: SAT1,
      amount: "10000000" // Issue 10M SAT1
    }))
    .addOperation(Operation.payment({
      destination: recipientWallet.publicKey(),
      asset: SAT2,
      amount: "15000000" // Issue 15M SAT2
    }))
    .setTimeout(30)
    .build();

    issueTransaction.sign(liquidityProviderWallet);
    await server.submitTransaction(issueTransaction);
    console.log("Assets issued successfully");

    // Transfer tokens back to LP (no trustlines needed since LP is the issuer)
    recipientAccount = await server.loadAccount(recipientWallet.publicKey());
    
    const transferTransaction = new TransactionBuilder(recipientAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.payment({
      destination: liquidityProviderWallet.publicKey(),
      asset: SAT1,
      amount: "6000000" // 6M SAT1 for LP
    }))
    .addOperation(Operation.payment({
      destination: liquidityProviderWallet.publicKey(),
      asset: SAT2,
      amount: "10000000" // 10M SAT2 for LP
    }))
    .setTimeout(30)
    .build();

    transferTransaction.sign(recipientWallet);
    await server.submitTransaction(transferTransaction);
    console.log("Tokens transferred to LP");

    // Check balances
    liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey());
    console.log("LP Balances after asset creation:", liquidityProviderAccount.balances);

    // Create Liquidity Pools
    console.log("Creating liquidity pools...");

    // XLM/SAT1 Pool (XLM comes first lexicographically)
    const xlmSat1Pool = new LiquidityPoolAsset(XLM, SAT1, 30); // 0.30% fee
    const xlmSat1PoolId = getLiquidityPoolId("constant_product", xlmSat1Pool).toString('hex');
    console.log("XLM/SAT1 Pool ID:", xlmSat1PoolId);

    // XLM/SAT2 Pool (XLM comes first lexicographically)
    const xlmSat2Pool = new LiquidityPoolAsset(XLM, SAT2, 30); // 0.30% fee
    const xlmSat2PoolId = getLiquidityPoolId("constant_product", xlmSat2Pool).toString('hex');
    console.log("XLM/SAT2 Pool ID:", xlmSat2PoolId);

    // SAT1/SAT2 Pool
    const sat1Sat2Pool = new LiquidityPoolAsset(SAT1, SAT2, 30); // 0.30% fee
    const sat1Sat2PoolId = getLiquidityPoolId("constant_product", sat1Sat2Pool).toString('hex');
    console.log("SAT1/SAT2 Pool ID:", sat1Sat2PoolId);

    // Create trustlines to the liquidity pools
    liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey());
    
    const poolTrustlineTransaction = new TransactionBuilder(liquidityProviderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.changeTrust({
      asset: xlmSat1Pool,
    }))
    .addOperation(Operation.changeTrust({
      asset: xlmSat2Pool,
    }))
    .addOperation(Operation.changeTrust({
      asset: sat1Sat2Pool,
    }))
    .setTimeout(30)
    .build();

    poolTrustlineTransaction.sign(liquidityProviderWallet);
    await server.submitTransaction(poolTrustlineTransaction);
    console.log("Pool trustlines created");

    // Deposit liquidity to pools
    console.log("Depositing liquidity to pools...");

    // Deposit to SAT1/XLM Pool: 5M SAT1 + 4000 XLM
    liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey());
    
    const depositSat1XlmTransaction = new TransactionBuilder(liquidityProviderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.liquidityPoolDeposit({
      liquidityPoolId: xlmSat1PoolId,
      maxAmountA: "4000", // 4000 XLM (first asset)
      maxAmountB: "5000000", // 5M SAT1 (second asset)
      minPrice: "0.0001",
      maxPrice: "10000"
    }))
    .setTimeout(30)
    .build();

    depositSat1XlmTransaction.sign(liquidityProviderWallet);
    await server.submitTransaction(depositSat1XlmTransaction);
    console.log("SAT1/XLM pool liquidity deposited");

    // Deposit to SAT2/XLM Pool: 8M SAT2 + 4000 XLM
    liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey());
    
    const depositSat2XlmTransaction = new TransactionBuilder(liquidityProviderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.liquidityPoolDeposit({
      liquidityPoolId: xlmSat2PoolId,
      maxAmountA: "4000", // 4000 XLM (first asset)
      maxAmountB: "8000000", // 8M SAT2 (second asset)
      minPrice: "0.0001",
      maxPrice: "10000"
    }))
    .setTimeout(30)
    .build();

    depositSat2XlmTransaction.sign(liquidityProviderWallet);
    await server.submitTransaction(depositSat2XlmTransaction);
    console.log("SAT2/XLM pool liquidity deposited");

    // Deposit to SAT1/SAT2 Pool
    // Based on the XLM ratios: SAT1 (5M:4000) vs SAT2 (8M:4000)
    // SAT1 is worth 4000/5M = 0.0008 XLM per token
    // SAT2 is worth 4000/8M = 0.0005 XLM per token
    // So SAT1:SAT2 ratio should be approximately 0.0008:0.0005 = 1.6:1
    // Using 800k SAT1 and 500k SAT2 for balanced ratio
    liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey());
    
    const depositSat1Sat2Transaction = new TransactionBuilder(liquidityProviderAccount, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
    .addOperation(Operation.liquidityPoolDeposit({
      liquidityPoolId: sat1Sat2PoolId,
      maxAmountA: "800000", // 800k SAT1
      maxAmountB: "500000", // 500k SAT2 (maintains similar value ratio)
      minPrice: "0.0001",
      maxPrice: "10000"
    }))
    .setTimeout(30)
    .build();

    depositSat1Sat2Transaction.sign(liquidityProviderWallet);
    await server.submitTransaction(depositSat1Sat2Transaction);
    console.log("SAT1/SAT2 pool liquidity deposited");

    // Final balance check
    liquidityProviderAccount = await server.loadAccount(liquidityProviderWallet.publicKey());
    console.log("Final LP Balances:", liquidityProviderAccount.balances);

    console.log("\n=== SUMMARY ===");
    console.log("Assets created: SAT1, SAT2");
    console.log("Pools created:");
    console.log(`- XLM/SAT1 Pool (${xlmSat1PoolId}): 4000 XLM + 5M SAT1`);
    console.log(`- XLM/SAT2 Pool (${xlmSat2PoolId}): 4000 XLM + 8M SAT2`);
    console.log(`- SAT1/SAT2 Pool (${sat1Sat2PoolId}): 800k SAT1 + 500k SAT2`);
    console.log("Liquidity Provider Public Key:", liquidityProviderWallet.publicKey());

    // Now we should also create the assets on Soroban
    
  } catch (error) {
    console.error("Error:", error);
    if (error instanceof Error && 'response' in error) {
      const errorWithResponse = error as any;
      if (errorWithResponse.response && errorWithResponse.response.data) {
        console.error("Response data:", errorWithResponse.response.data);
      }
    }
  }
}

// Execute the function
createAssetsAndAddLiquidity();
