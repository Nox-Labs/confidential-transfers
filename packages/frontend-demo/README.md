> This project currently in development and should be used only for testing purposes. Not a standalone project, should be used from root project.

# Frontend Demo for Confidential Transfers

> This package cannot be used standalone without the backend service, and scripts in root project.

## Installation

```bash
npm install
```

## Usage

1. Run local anvil network:

```bash
anvil
```

2. Deploy the mock ERC20 token (run this script in root project):

```bash
npm run deploy:mock:anvil
```

4. Start the backend service (see [backend-service](../backend-service/README.md))
5. Start the frontend demo:

> Optionally configure the `src/config.ts` file with the correct API URL and contract address

```bash
npm run start
```

6. Add local anvil network to your wallet (see anvil terminal for the RPC URL)

7. Add anvil 0 and 1 addresses to your wallet (see anvil terminal for the private keys)

8. Open the browser and navigate to `http://localhost:3001`
