import { clusterApiUrl, Connection, TransactionMessage, VersionedTransaction } from '@solana/web3.js';
const environment = process.env.ENVIRONMENT || 'development';
console.log(`Environment: ${environment}`);
const rpcUrl = environment === 'production'
    ? process.env.RPC_URL || clusterApiUrl('mainnet-beta')
    : process.env.RPC_URL || clusterApiUrl('devnet');
export const connection = new Connection(rpcUrl);
export async function prepareTransaction(instructions, payer) {
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
