import {
  clusterApiUrl, Connection,
  PublicKey,
  TransactionInstruction,
  TransactionMessage,
  VersionedTransaction
} from '@solana/web3.js';
import dotenv from 'dotenv';
dotenv.config();

const environment = process.env.ENVIRONMENT || 'development';

const rpcUrl =
  environment === 'production'
    ? process.env.RPC_URL || clusterApiUrl('mainnet-beta')
    : process.env.RPC_URL || clusterApiUrl('devnet');
console.log(`RPC URL: ${rpcUrl}`);
console.log(`Environment: ${environment}`);

export const connection = new Connection(rpcUrl);

export async function prepareTransaction(
  instructions: TransactionInstruction[],
  payer: PublicKey
) {
  const blockhash = await connection
    .getLatestBlockhash({ commitment: 'max' })
    .then((res) => res.blockhash);
  const messageV0 = new TransactionMessage({
    payerKey: payer,
    recentBlockhash: blockhash,
    instructions
  }).compileToV0Message();
  return new VersionedTransaction(messageV0);
}
