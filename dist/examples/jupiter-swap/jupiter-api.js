import { createJupiterApiClient, } from '@jup-ag/api';
export const createJupiterApi = () => {
    const jupiterApi = createJupiterApiClient();
    const getTokenPricesInUsdc = async (tokenIds) => {
        if (tokenIds.length === 0) {
            return {};
        }
        const url = `https://price.jup.ag/v4/price?ids=${tokenIds.join(',')}&vsToken=USDC`;
        const response = await fetch(url);
        const parsedResponse = (await response.json());
        return parsedResponse.data;
    };
    const getTokenPriceInSol = async (tokenIds) => {
        if (tokenIds.length === 0) {
            return {};
        }
        const url = `https://price.jup.ag/v4/price?ids=${tokenIds.join(',')}&vsToken=SOL`;
        const response = await fetch(url);
        const parsedResponse = (await response.json());
        return parsedResponse.data;
    };
    const quoteGet = async (request) => {
        return await jupiterApi.quoteGet(request);
    };
    const swapPost = async (request) => {
        return await jupiterApi.swapPost(request);
    };
    const getTokenList = async () => {
        try {
            const response = await fetch('https://token.jup.ag/all');
            if (!response.ok) {
                return [];
            }
            return await response.json();
        }
        catch (e) {
            console.error(e);
            return [];
        }
    };
    const getStrictList = async () => {
        try {
            const response = await fetch('https://token.jup.ag/strict');
            if (!response.ok) {
                return [];
            }
            return await response.json();
        }
        catch (e) {
            console.error(e);
            return [];
        }
    };
    const lookupToken = async (token) => {
        if (!token) {
            return null;
        }
        const tokenLowercase = token.toLowerCase().trim();
        const jupiterTokenMetadata = await getStrictList();
        const jupTokenMetaDatum = jupiterTokenMetadata.find((token) => token.symbol?.toLowerCase() === tokenLowercase ||
            token.address?.toLowerCase() === tokenLowercase);
        return jupTokenMetaDatum ?? null;
    };
    return {
        getTokenPricesInUsdc,
        getTokenPriceInSol,
        quoteGet,
        swapPost,
        lookupToken,
    };
};
const jupiterApi = createJupiterApi();
export default jupiterApi;
