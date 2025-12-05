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

3. Download the zk keys as mentioned in [sdk](../sdk/README.md)

4. Start the backend service (see [backend-service](../backend-service/README.md))

5. Start the frontend demo:

> Optionally configure the `src/config.ts` file with the correct API URL and contract address

```bash
npm run dev
```
