#!/bin/bash
set -e

# Check if a circuit name is provided
if [ -z "$1" ]; then
  echo "Error: No circuit name provided."
  echo "Usage: npm run rebuild-circuit -- <circuit_name>"
  exit 1
fi

CIRCUIT_NAME=$1
# Capitalize the first letter of the circuit name (e.g., deposit -> Deposit)
CAPITALIZED_NAME="$(tr '[:lower:]' '[:upper:]' <<< ${CIRCUIT_NAME:0:1})${CIRCUIT_NAME:1}"
VERIFIER_NAME="${CAPITALIZED_NAME}PlonkVerifier"

# Define directories
HELPERS_DIR="packages/sdk/src/artifacts/proofs-helpers"
KEYS_DIR="out/zk/keys"
VERIFIER_DIR="src/verifiers"
CIRCUIT_FILE="circuits/${CIRCUIT_NAME}.circom"

# Check if circuit file exists
if [ ! -f "$CIRCUIT_FILE" ]; then
    echo "Error: Circuit file not found at $CIRCUIT_FILE"
    exit 1
fi

echo "--- Rebuilding circuit: $CIRCUIT_NAME ---"

# 1. Compile the circuit
echo "[1/3] Compiling circuit..."
mkdir -p $HELPERS_DIR
circom $CIRCUIT_FILE --r1cs --wasm -l node_modules -o $HELPERS_DIR

# 2. Setup PLONK keys
echo "[2/3] Setting up PLONK keys..."
mkdir -p "$KEYS_DIR/$CIRCUIT_NAME"
npx snarkjs plonk setup "$HELPERS_DIR/$CIRCUIT_NAME.r1cs" "powersOfTau28_hez_final_16.ptau" "$KEYS_DIR/$CIRCUIT_NAME/${CIRCUIT_NAME}_final.zkey"

# 3 Remove the .r1cs files
echo "[3/3] Removing .r1cs files..."
rm -f "$HELPERS_DIR/$CIRCUIT_NAME.r1cs"

# 4. Generate the verifier contract
echo "[4/4] Generating verifier contract..."
mkdir -p $VERIFIER_DIR
npx snarkjs zkey export solidityverifier "$KEYS_DIR/$CIRCUIT_NAME/${CIRCUIT_NAME}_final.zkey" "$VERIFIER_DIR/${VERIFIER_NAME}.sol"

echo "✅ Success! Verifier contract generated at $VERIFIER_DIR/${VERIFIER_NAME}.sol"
