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

const STAKE_POOL = 'Fu9BYC6tWBo1KMKaP3CFoKfRhqv9akmy3DuYwnCyWiyC';
const DEFAULT_STAKE_AMOUNT = '1';
const DEFAULT_STAKE_AMOUNT_OPTIONS = ['1', '5', '10'];

const app = new OpenAPIHono();

app.openapi(
  createRoute({
    method: 'get',
    path: '/',
    tags: ['Stake'],
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const { icon, title, description } = getStakeInfo();
    const amountParameterName = 'amount';
    const response: ActionsSpecGetResponse = {
      icon,
      label: `${DEFAULT_STAKE_AMOUNT} SOL`,
      title,
      description,
      links: {
        actions: [
          ...DEFAULT_STAKE_AMOUNT_OPTIONS.map((amount) => ({
            label: `${amount} SOL`,
            href: `/api/stake/${amount}`,
          })),
          {
            href: `/api/stake/{${amountParameterName}}`,
            label: 'Stake',
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
    method: 'get',
    path: '/{amount}',
    tags: ['Stake'],
    request: {
      params: z.object({
        amount: z.string().openapi({
          param: {
            name: 'amount',
            in: 'path',
          },
          type: 'number',
          example: '1',
        }),
      }),
    },
    responses: actionsSpecOpenApiGetResponse,
  }),
  (c) => {
    const amount = c.req.param('amount');
    const { icon, title, description } = getStakeInfo();
    const response: ActionsSpecGetResponse = {
      icon,
      label: `${amount} SOL`,
      title,
      description,
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
    const payerKey = new PublicKey(account);
    try {
      const transaction = await createTransaction(payerKey, parsedAmount);
      const response: ActionsSpecPostResponse = {
        transaction: Buffer.from(transaction.serialize()).toString('base64'),
      };
      return c.json(response, 200);
    } catch (error: any) {
      const errorResponse: ActionError = {
        message: error.message,
      };
      return c.json(errorResponse, 200);
    }
  });

async function createTransaction(payerKey: PublicKey, parsedAmount: number) {
  const { instructions } = await depositSol(
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
  return transaction;
}

function getStakeInfo(): Pick<
  ActionsSpecGetResponse,
  'icon' | 'title' | 'description'
> {
  const icon =
    'https://thevault.finance/favicon.png';
  const title = 'Stake to The Vault';
  const description =
    'vSOL is a stake pool that supports community-focused validators. Stake with us now to support the Solana native communities!';
  return { icon, title, description };
}

export default app;
