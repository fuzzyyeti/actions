import { serve } from '@hono/node-server';
import theVault from './the-vault/route';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { OpenAPIHono } from '@hono/zod-openapi';
import dotenv from 'dotenv';

dotenv.config();

const app = new OpenAPIHono();

app.use(cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'Content-Encoding', 'Accept-Encoding'],
}));

console.log(process.env.ENVIRONMENT);
console.log(process.env.RPC_URL);

// return an actions.json on the base url
app.get('/actions.json', (c) => {
  return c.json(
     {
      rules: [
        {
          pathPattern: "/stake",
          apiPath: "/api/stake"
        },
        {
          pathPattern: "/stake/*",
          apiPath: "/api/stake/*"
        },
        {
          pathPattern: "/stake/directed/*",
          apiPath: "/api/stake/directed/*"
        }
     ]}
  );
});

// <--Actions-->
app.route('api/stake', theVault);
// </--Actions-->

app.doc('/doc', {
  info: {
    title: 'An API',
    version: 'v1',
  },
  openapi: '3.1.0',
});

app.get(
  '/swagger-ui',
  swaggerUI({
    url: '/doc',
  }),
);

app.use('*' as string, async (c, next) => {
  const host = c.req.header('host');
  if (host === 'blink.thevault.finance') {
    return c.redirect('http://thevault.finance');
  }
  return next();
});


const port = 3000;
console.log(
  `Server is running on port ${port}
Visit http://localhost:${port}/swagger-ui to explore existing actions
Visit https://actions.dialect.to to unfurl action into a Blink
`,
);

serve({
  fetch: app.fetch,
  port,
});
