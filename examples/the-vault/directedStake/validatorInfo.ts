import { Connection, ParsedAccountData, PublicKey } from '@solana/web3.js';

import { stakePoolInfo } from '@solana/spl-stake-pool';

export type ValidatorInfo = {
  moniker: string;
  pictureURL: string | null;
  identityPubkey: string | null;
};

// Cache for validator data to avoid repeated fetches
let cachedValidatorInfo: any[] | null = null;
let cachedValidators: any | null = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Fetch validator info from GitHub repository
async function fetchValidatorInfo(): Promise<any[]> {
  const now = Date.now();
  if (cachedValidatorInfo && now - lastFetchTime < CACHE_DURATION) {
    return cachedValidatorInfo;
  }

  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/SolanaVault/vault-lst-list-generator/refs/heads/main/validatorInfo.json"
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch validator info: ${response.status}`);
    }
    cachedValidatorInfo = await response.json();
    lastFetchTime = now;
    return cachedValidatorInfo || [];
  } catch (error) {
    console.error('Error fetching validator info:', error);
    return cachedValidatorInfo || [];
  }
}

// Fetch validators from GitHub repository
async function fetchValidators(): Promise<any> {
  const now = Date.now();
  if (cachedValidators && now - lastFetchTime < CACHE_DURATION) {
    return cachedValidators;
  }

  try {
    const response = await fetch(
      "https://raw.githubusercontent.com/SolanaVault/vault-lst-list-generator/refs/heads/main/validators.json"
    );
    if (!response.ok) {
      throw new Error(`Failed to fetch validators: ${response.status}`);
    }
    cachedValidators = await response.json();
    lastFetchTime = now;
    return cachedValidators;
  } catch (error) {
    console.error('Error fetching validators:', error);
    return cachedValidators || { validators: [] };
  }
}

export const getValidatorInfoFromIdentityPubkey = async (
  identityPubkey: PublicKey,
): Promise<ValidatorInfo | undefined> => {
  const validatorInfo = await fetchValidatorInfo();
  const info = validatorInfo.find(
    (v: any) => v.identityPubkey === identityPubkey.toString(),
  );
  if (!info) {
    return undefined;
  }
  return {
    moniker: info?.info.name ?? identityPubkey.toString(),
    pictureURL:
      info?.info.iconUrl ??
      (info?.info.keybaseUsername
        ? `https://keybase.io/${info.info.keybaseUsername}/picture?format=square_40`
        : null) ??
      null,
    identityPubkey: info?.identityPubkey ?? null,
  };
};

export const getVoteKeyFromIdentityPubkey = async (
  identityPubkey: PublicKey,
): Promise<PublicKey | undefined> => {
  const validators = await fetchValidators();
  const info = validators.validators.find(
    (v: any) => v.identityPubkey === identityPubkey.toString(),
  );
  if (!info) {
    return undefined;
  }
  return new PublicKey(info.voteAccountPubkey);
};

export const getValidatorInfoFromVotePubkey = async (
  votePubkey: PublicKey,
): Promise<ValidatorInfo | undefined> => {
  const validators = await fetchValidators();
  // Find the current validator info
  const currentValidatorIdentityPubkey = validators.validators.find((v: any) =>
    new PublicKey(v.voteAccountPubkey).equals(votePubkey),
  )?.identityPubkey;

  if (!currentValidatorIdentityPubkey) return undefined;

  return getValidatorInfoFromIdentityPubkey(
    new PublicKey(currentValidatorIdentityPubkey),
  );
};

function listToDict<T>(
  list: T[],
  idGen: (arg: T) => string,
): { [key: string]: T } {
  const dict: { [key: string]: T } = {};

  list.forEach((element) => {
    const dictKey = idGen(element);
    dict[dictKey] = element;
  });

  return dict;
}

async function getAllValidators(connection: Connection) {
  let validatorAccounts = await connection.getParsedProgramAccounts(
    new PublicKey('Config1111111111111111111111111111111111111'),
  );

  const voteAccounts = await connection.getVoteAccounts();
  const voteAccountsByIdentity = listToDict(
    [...voteAccounts.current, ...voteAccounts.delinquent],
    (v) => v.nodePubkey,
  );

  // Filter
  validatorAccounts = validatorAccounts.filter((validatorAccount) => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
    const data: any = validatorAccount.account.data;

    if (
      !data ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !data['parsed'] ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !data['parsed']['info'] ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !data['parsed']['info']['configData'] ||
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      !data['parsed']['info']['keys']
    )
      return false;

    return true;
  });

  // Map to dictionary so that we get rid of duplicates
  const validatorAccountsDict = listToDict(
    validatorAccounts,
    (validator_account) =>
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access
      (validator_account.account.data as ParsedAccountData).parsed[
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        'info'
        ]['keys'][1]['pubkey'],
  );

  return Object.values(validatorAccountsDict).map((validatorAccount) => {
    const data = validatorAccount.account.data as ParsedAccountData;

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
    const info: {
      name: string;
      details: string;
      website: string;
      iconUrl: string;
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
    } = data.parsed['info']['configData'];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access
    const keys: { pubkey: string }[] = data.parsed['info']['keys'];

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const identityPubkey: string =
      keys && keys.length > 1 && keys[1] ? keys[1].pubkey : '';

    const votePubkey = voteAccountsByIdentity[identityPubkey].votePubkey;

    console.log(identityPubkey, votePubkey);

    return {
      identityPubKey: identityPubkey,
      votePubKey: votePubkey,
      name: info.name,
      iconUrl: info.iconUrl,
      website: info.website,
      details: info.details,
    };
  });
}

export const getAvailableValidators = async (): Promise<ValidatorInfo[]> => {
  const connection = new Connection(process.env.RPC_URL!);
  const allValidators = await getAllValidators(connection);

  console.log(`allValidators: ${allValidators.length}`);

  const poolInfo = await stakePoolInfo(connection, new PublicKey(process.env.STAKE_POOL_ADDRESS!));

  console.log(allValidators[0]);
  console.log(poolInfo.validatorList[0]);

  return allValidators
    .filter((validator) => {
      return (
        poolInfo.validatorList.find(
          (v) => v.voteAccountAddress === validator.votePubKey,
        ) !== undefined
      );
    })
    .map((info) => {
      return {
        moniker: info.name ?? info.votePubKey,
        pictureURL: info.iconUrl,
        identityPubkey: info.identityPubKey,
      };
    });
};
