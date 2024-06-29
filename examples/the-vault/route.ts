import {
  LAMPORTS_PER_SOL, MessageV0,
  PublicKey,
  SystemProgram, TransactionInstruction, TransactionMessage,
  VersionedTransaction,
} from '@solana/web3.js';
import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi';
import {
  actionSpecOpenApiPostRequestBody,
  actionsSpecOpenApiGetResponse,
  actionsSpecOpenApiPostResponse,
} from '../openapi';
import {
  ActionError,
  ActionsSpecGetResponse,
  ActionsSpecPostRequestBody,
  ActionsSpecPostResponse,
} from '../../spec/actions-spec';
import { connection, prepareTransaction } from '../transaction-utils';
import { depositSol } from '@solana/spl-stake-pool';
import { getValidatorInfoFromIdentityPubkey, getValidatorInfoFromVotePubkey } from './directedStake/validatorInfo';

const STAKE_POOL = 'Fu9BYC6tWBo1KMKaP3CFoKfRhqv9akmy3DuYwnCyWiyC';
const DEFAULT_STAKE_AMOUNT = '1';
const DEFAULT_STAKE_AMOUNT_OPTIONS = ['1', '5', '10'];

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Stake'],
    request: {
      query: z.object({
        direct: z.string().openapi({
          param: {
            name: 'direct',
            in: 'query',
            required: false,
          },
          type: 'string',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const { icon, title, description } = getStakeInfo();
    const { direct } = c.req.valid('query');
    let directKey = undefined;
    try {
      directKey = new PublicKey(direct);
    } catch (error) {
      const errorResponse: ActionError = {
        message: 'direct query string must be a valid base58 public key',
      };
      return c.json(errorResponse, 422);
    }
    const info = getValidatorInfoFromIdentityPubkey(directKey);
    if (!info) {
      const errorResponse: ActionError = {
        message: 'Unable to find validator info for the provided public key',
      };
      return c.json(errorResponse, 422);
    }
    let directTitle = undefined;
    if (info.moniker) {
      directTitle = `Stake to The Vault - directed to ${info?.moniker}`;
    }
    const amountParameterName = 'amount';
    const response: ActionsSpecGetResponse = {
      icon,
      label: `${DEFAULT_STAKE_AMOUNT} SOL`,
      title: directTitle ?? title,
      description,
      links: {
        actions: [
          ...DEFAULT_STAKE_AMOUNT_OPTIONS.map((amount) => ({
            label: `${amount} SOL`,
            href: `/api/stake/${amount}`,
          })),
          {
            href: `/api/stake/{${amountParameterName}}`,
            label: `Stake`,
            parameters: [
              {
                name: amountParameterName,
                label: 'Enter a custom SOL amount',
              },
            ],
          },
        ],
      },
    };

    return c.json(response, 200);
  },
);

app.openapi(
  createRoute({
    method: 'post',
    path: '/{amount}',
    tags: ['Stake'],
    request: {
      params: z.object({
        amount: z
          .string()
          .optional()
          .openapi({
            param: {
              name: 'amount',
              in: 'path',
              required: false,
            },
            type: 'number',
            example: '1',
          }),
      }),
      body: actionSpecOpenApiPostRequestBody,
    },
    responses: actionsSpecOpenApiPostResponse,
  }),
  async (c) => {
    const amount =
      c.req.param('amount') ?? DEFAULT_STAKE_AMOUNT.toString();
    const { account } = (await c.req.json()) as ActionsSpecPostRequestBody;
    const parsedAmount = parseFloat(amount);
    if(parsedAmount <= 0 || isNaN(parsedAmount)) {
      const errorResponse: ActionError = {
        message: 'Enter a valid amount',
      };
      return c.json(errorResponse, 422);
    }
    const payerKey = new PublicKey(account);
    try {
      const transaction = await createTransaction(payerKey, parsedAmount);
      const response: ActionsSpecPostResponse = {
        transaction: Buffer.from(transaction.serialize()).toString('base64'),
        message: `Staked ${parsedAmount} SOL to The Vault`,
        redirect: "https://thevault.finance/"
      };
      return c.json(response, 200);
    } catch (error: any) {
      const errorResponse: ActionError = {
        message: error.message,
      };
      return c.json(errorResponse, 422);
    }
  });

async function createTransaction(payerKey: PublicKey, parsedAmount: number) {
  console.log('RPC', connection.rpcEndpoint)
  const { instructions , signers} = await depositSol(
    connection,
    new PublicKey(STAKE_POOL),
    payerKey,
    parsedAmount * LAMPORTS_PER_SOL,
  );
  const { blockhash } = await connection.getLatestBlockhash();
  const txMessage = new TransactionMessage({
    payerKey,
    instructions,
    recentBlockhash: blockhash,
  });
  const transaction = new VersionedTransaction(txMessage.compileToV0Message());
  transaction.sign(signers);
  return transaction;
}

function getStakeInfo(): Pick<
  ActionsSpecGetResponse,
  'icon' | 'title' | 'description'
> {
  const icon = 'https://solanavault.s3.amazonaws.com/vSolBanner.webp'
  const title = 'Stake to The Vault';
  const description =
    'The LST of The Vault Finance. The growth focused stake pool.';
  return { icon, title, description };
}

export default app;
