export default () => ({
  port: Number(process.env.PORT) || 3000,
  rpcUrl: process.env.RPC_URL || "http://127.0.0.1:8545",
  contractAddress:
    process.env.CONTRACT_ADDRESS ||
    "0x5fc8d32690cc91d4c39d9d3abcbd16989f875707",
  proofsHelpersPath:
    process.env.PROOFS_HELPERS_PATH ||
    "node_modules/@noxlabs/confidential-transfers-sdk/artifacts/proofs-helpers/",
  proofsKeysPath: process.env.PROOFS_KEYS_PATH || "keys/",
})
