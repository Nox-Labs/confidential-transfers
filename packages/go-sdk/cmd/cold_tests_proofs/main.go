package main

import (
	"context"
	"crypto/ecdsa"
	"encoding/json"
	"fmt"
	"log"
	"math/big"
	"os"
	"path/filepath"
	"strings"

	"github.com/ethereum/go-ethereum/accounts/abi"
	"github.com/ethereum/go-ethereum/accounts/abi/bind"
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/crypto"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/noxlabs/confidential-transfers-go-sdk/sdk"
	confidential_transfers "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfers"
	confidential_transfers_bridgeable "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfersBridgeable"
)

var (
	ProofsDir = "cmd/cold_tests_proofs/proofs"

	MintAmount     = new(big.Int).Mul(big.NewInt(1000), big.NewInt(1e18))
	BurnAmount     = new(big.Int).Mul(big.NewInt(1), big.NewInt(1e18))
	DepositAmount  = new(big.Int).Mul(big.NewInt(100), big.NewInt(1e18))
	WithdrawAmount = new(big.Int).Mul(big.NewInt(10), big.NewInt(1e18))
	TransferAmount = new(big.Int).Mul(big.NewInt(10), big.NewInt(1e18))

	// User Private Keys from test/hardhat/BaseSetup.ts
	User1PrivateKey = "59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
	User2PrivateKey = "5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"

	mockAbiJSON = `[{"inputs":[{"internalType":"uint256","name":"recipientPubKeyX","type":"uint256"},{"internalType":"uint256","name":"recipientPubKeyY","type":"uint256"},{"components":[{"internalType":"address","name":"sender","type":"address"},{"components":[{"internalType":"uint256","name":"nonce","type":"uint256"},{"internalType":"uint256","name":"commitment","type":"uint256"},{"internalType":"uint256","name":"eAmount","type":"uint256"}],"internalType":"struct Payload","name":"payload","type":"tuple"},{"components":[{"internalType":"address","name":"auditor","type":"address"},{"internalType":"uint256","name":"eOTK","type":"uint256"}],"internalType":"struct AuditReport[]","name":"auditReports","type":"tuple[]"}],"internalType":"struct PendingTransfer","name":"pendingTransfer","type":"tuple"}],"name":"addFailedCrossChainTransfer","outputs":[],"stateMutability":"nonpayable","type":"function"}]`
)

type User struct {
	Index      int
	PrivateKey *ecdsa.PrivateKey
	Address    common.Address
	Auth       *bind.TransactOpts
}

type Payload struct {
	Nonce      *big.Int
	Commitment *big.Int
	EAmount    *big.Int
}

type AuditReport struct {
	Auditor common.Address
	EOTK    *big.Int
}

type PendingTransfer struct {
	Sender       common.Address
	Payload      Payload
	AuditReports []AuditReport
}

func main() {
	// Connect to RPC
	client, err := ethclient.Dial("http://localhost:8545")
	if err != nil {
		log.Fatalf("Failed to connect to the Ethereum client: %v", err)
	}

	// This address should be updated to the deployed contract address
	// For now using the one from the original stub or placeholder
	tokenAddress := common.HexToAddress("0x0165878A594ca255338adfa4d48449f69242Eb8F")

	// Setup Prover
	cwd, _ := os.Getwd()
	// Assuming running from project root
	zkeyDir := filepath.Join(cwd, "../../out/zk/keys")
	wasmDir := filepath.Join(cwd, "../sdk/src/artifacts/proofs-helpers")
	prover := sdk.NewSnarkJSProver(zkeyDir, wasmDir, "npx snarkjs")

	options := sdk.SDKOptions{
		Type: sdk.SDKTypeConfidentialTransfersBridgeable,
	}

	mySdk := sdk.NewSDK(tokenAddress, client, prover, options)

	// Setup Users
	user1, err := setupUser(User1PrivateKey, 1, client)
	if err != nil {
		log.Fatalf("Failed to setup user1: %v", err)
	}
	user2, err := setupUser(User2PrivateKey, 2, client)
	if err != nil {
		log.Fatalf("Failed to setup user2: %v", err)
	}

	// Create proofs directory if not exists
	if _, err := os.Stat(ProofsDir); os.IsNotExist(err) {
		err := os.MkdirAll(ProofsDir, 0755)
		if err != nil {
			log.Fatalf("Failed to create proofs directory: %v", err)
		}
	}

	// --- 1. Init Proof user1 ---
	if err := initUser(mySdk, user1, true); err != nil {
		log.Fatalf("Init user1 failed: %v", err)
	}

	// --- 2. Init Proof user2 ---
	if err := initUser(mySdk, user2, true); err != nil {
		log.Fatalf("Init user2 failed: %v", err)
	}

	// --- 3. Deposit Proof user1 ---
	if err := deposit(mySdk, user1, true); err != nil {
		log.Fatalf("Deposit user1 failed: %v", err)
	}

	{
		// --- 3.1 Deposit Proof user1 ---
		if err := deposit(mySdk, user1, false); err != nil {
			log.Fatalf("Deposit user1 (no exec) failed: %v", err)
		}

		// --- 3.1 Withdraw Proof ---
		if err := withdraw(mySdk, user1, false); err != nil {
			log.Fatalf("Withdraw user1 failed: %v", err)
		}

		// --- 3.3 Mint Proof user1 ---
		if err := mint(mySdk, user1, false); err != nil {
			log.Fatalf("Mint user1 failed: %v", err)
		}

		// --- 3.4 Burn Proof user1 ---
		if err := burn(mySdk, user1, false); err != nil {
			log.Fatalf("Burn user1 failed: %v", err)
		}
	}

	// --- 4. Transfer Proof ---
	if err := transfer(mySdk, user1, user2, true); err != nil {
		log.Fatalf("Transfer user1 -> user2 failed: %v", err)
	}

	{
		// --- 4.1 Apply Proof ---
		if err := apply(mySdk, user2, false, []int{0}); err != nil {
			log.Fatalf("Apply user2 [0] failed: %v", err)
		}

		// --- 4.1 Withdraw Proof ---
		if err := withdraw(mySdk, user1, false); err != nil { // TS line 51 calls withdraw(false) (user1 implicit)
			log.Fatalf("Withdraw user1 failed: %v", err)
		}

		// --- 4.3 Mint Proof user1 ---
		if err := mint(mySdk, user1, false); err != nil {
			log.Fatalf("Mint user1 failed: %v", err)
		}

		// --- 4.4 Burn Proof user1 ---
		if err := burn(mySdk, user1, false); err != nil {
			log.Fatalf("Burn user1 failed: %v", err)
		}

		// --- 4.1 Apply and Transfer Proof ---
		if err := applyAndTransfer(mySdk, user2, user1, false, []int{0}); err != nil {
			log.Fatalf("ApplyAndTransfer user2 -> user1 [0] failed: %v", err)
		}

		// --- 3.1 Claim Proof ---
		{
			nonce, err := getNonce(mySdk, user1.Address)
			if err != nil {
				log.Fatalf("Failed to get nonce: %v", err)
			}
			filename := ProofFilenameForColdTest(Transfer, user1.Index, int(nonce.Int64())-1, TransferAmount, nil)
			proofOutput, err := getProofOutput(filename)
			if err != nil {
				log.Fatalf("Failed to get proof output for claim: %v", err)
			}

			// Add failed cross chain transfer (MOCK CALL)
			if err := addFailedCrossChainTransfer(client, tokenAddress, user1, user2, nonce, proofOutput); err != nil {
				log.Printf("Warning: Failed to add failed cross chain transfer (expected if not Mock contract): %v", err)
			}

			if err := claim(mySdk, user1, false, 0); err != nil {
				log.Fatalf("Claim user1 failed: %v", err)
			}
		}
	}

	// --- 5 Transfer Proof ---
	if err := transfer(mySdk, user1, user2, true); err != nil {
		log.Fatalf("Transfer user1 -> user2 failed: %v", err)
	}

	{
		// --- 5.1 Apply Proof ---
		if err := apply(mySdk, user2, false, []int{1}); err != nil {
			log.Fatalf("Apply user2 [1] failed: %v", err)
		}
		// --- 5.1 Apply Proof ---
		if err := apply(mySdk, user2, false, []int{0, 1}); err != nil {
			log.Fatalf("Apply user2 [0, 1] failed: %v", err)
		}

		// --- 5.1 Apply Proof with special logic ---
		{
			execute := false
			indexes := []int{0, 0}
			nonce, _ := getNonce(mySdk, user2.Address)
			filename := ProofFilenameForColdTest(Apply, user2.Index, int(nonce.Int64()), nil, indexes)

			if !isFileExists(filename) || execute {
				cPrivateKey, err := sdk.DeriveConfidentialKeys(user2.PrivateKey.D)
				if err != nil {
					log.Fatalf("Failed to derive keys: %v", err)
				}
				ai, err := mySdk.GetCircuitInputsForApply(user2.Address, cPrivateKey.CPrivateKey, indexes)
				if err != nil {
					log.Fatalf("Failed to get inputs for apply: %v", err)
				}

				// Modify inputs as in TS
				ai.PendingTransfersCommitments[1] = ai.PendingTransfersCommitments[0]
				ai.PendingTransfersAmounts[1] = ai.PendingTransfersAmounts[0]
				ai.PendingTransfersOTKs[1] = ai.PendingTransfersOTKs[0]

				applyProofOutput, err := mySdk.GenerateApplyProof(ai)
				if err != nil {
					log.Fatalf("Failed to generate apply proof: %v", err)
				}

				// Convert indexes to []*big.Int
				bigIndexes := make([]*big.Int, len(indexes))
				for i, v := range indexes {
					bigIndexes[i] = big.NewInt(int64(v))
				}

				params := new(sdk.Params)
				applyParams := params.GetApplyParams(bigIndexes, *applyProofOutput, nil)

				if execute {
					contract, err := confidential_transfers.NewConfidentialTransfers(tokenAddress, client)
					if err != nil {
						log.Fatalf("Failed to bind contract: %v", err)
					}
					_, err = contract.CApply(user2.Auth, applyParams)
					if err != nil {
						log.Fatalf("Failed to execute cApply: %v", err)
					}
				}
				saveProofToFile(filename, applyProofOutput)
			}
		}

		// --- 6.3 Apply and Transfer Proof ---
		if err := applyAndTransfer(mySdk, user2, user1, false, []int{1}); err != nil {
			log.Fatalf("ApplyAndTransfer user2 -> user1 [1] failed: %v", err)
		}
		// --- 6.3 Apply and Transfer Proof ---
		if err := applyAndTransfer(mySdk, user2, user1, false, []int{0, 1}); err != nil {
			log.Fatalf("ApplyAndTransfer user2 -> user1 [0, 1] failed: %v", err)
		}
	}

	// --- 6. Transfer Proof ---
	if err := transfer(mySdk, user1, user2, true); err != nil {
		log.Fatalf("Transfer user1 -> user2 failed: %v", err)
	}

	{
		// --- 6.1 Apply Proof ---
		if err := apply(mySdk, user2, false, []int{2}); err != nil {
			log.Fatalf("Apply user2 [2] failed: %v", err)
		}
		// --- 6.1. Apply Proof ---
		if err := apply(mySdk, user2, false, []int{0, 2}); err != nil {
			log.Fatalf("Apply user2 [0, 2] failed: %v", err)
		}
		// --- 6.2 Apply Proof ---
		if err := apply(mySdk, user2, false, []int{0, 1, 2}); err != nil {
			log.Fatalf("Apply user2 [0, 1, 2] failed: %v", err)
		}
		// --- 6.3 Apply and Transfer Proof ---
		if err := applyAndTransfer(mySdk, user2, user1, false, []int{2}); err != nil {
			log.Fatalf("ApplyAndTransfer user2 -> user1 [2] failed: %v", err)
		}
		// --- 6.3 Apply and Transfer Proof ---
		if err := applyAndTransfer(mySdk, user2, user1, false, []int{0, 2}); err != nil {
			log.Fatalf("ApplyAndTransfer user2 -> user1 [0, 2] failed: %v", err)
		}
		// --- 6.3 Apply and Transfer Proof ---
		if err := applyAndTransfer(mySdk, user2, user1, false, []int{0, 1, 2}); err != nil {
			log.Fatalf("ApplyAndTransfer user2 -> user1 [0, 1, 2] failed: %v", err)
		}
	}

	// --- 7. Transfer Proof ---
	if err := transfer(mySdk, user1, user2, false); err != nil {
		log.Fatalf("Transfer user1 -> user2 failed: %v", err)
	}

	fmt.Printf("\nAll proofs have been generated and saved in '%s'\n", ProofsDir)
}

func setupUser(hexKey string, index int, client *ethclient.Client) (*User, error) {
	privateKey, err := crypto.HexToECDSA(hexKey)
	if err != nil {
		return nil, err
	}

	publicKey := privateKey.Public()
	publicKeyECDSA, ok := publicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, fmt.Errorf("error casting public key to ECDSA")
	}

	fromAddress := crypto.PubkeyToAddress(*publicKeyECDSA)
	chainID, err := client.NetworkID(context.Background())
	if err != nil {
		return nil, err
	}

	auth, err := bind.NewKeyedTransactorWithChainID(privateKey, chainID)
	if err != nil {
		return nil, err
	}

	return &User{
		Index:      index,
		PrivateKey: privateKey,
		Address:    fromAddress,
		Auth:       auth,
	}, nil
}

func getNonce(s *sdk.SDK, address common.Address) (*big.Int, error) {
	account, err := s.Token.GetAccount(nil, address)
	if err != nil {
		return nil, err
	}
	return account.State.Nonce, nil
}

func isFileExists(filename string) bool {
	path := filepath.Join(ProofsDir, filename+".json")
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}

type hexProofOutput struct {
	Proof      []string `json:"proof"`
	PubSignals []string `json:"pubSignals"`
}

func saveProofToFile(filename string, data *sdk.ProofOutput) {
	hex := hexProofOutput{
		Proof:      bigIntsToHex(data.Proof),
		PubSignals: bigIntsToHex(data.PubSignals),
	}
	filePath := filepath.Join(ProofsDir, filename+".json")
	file, _ := json.MarshalIndent(hex, "", "  ")
	_ = os.WriteFile(filePath, file, 0644)
	fmt.Printf("- Saved %s.json\n", filename)
}

func getProofOutput(filename string) (*sdk.ProofOutput, error) {
	filePath := filepath.Join(ProofsDir, filename+".json")
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}
	var raw struct {
		Proof      []json.RawMessage `json:"proof"`
		PubSignals []json.RawMessage `json:"pubSignals"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	proof, err := rawToBigInts(raw.Proof)
	if err != nil {
		return nil, fmt.Errorf("parse proof: %w", err)
	}
	pubSignals, err := rawToBigInts(raw.PubSignals)
	if err != nil {
		return nil, fmt.Errorf("parse pubSignals: %w", err)
	}
	return &sdk.ProofOutput{Proof: proof, PubSignals: pubSignals}, nil
}

func bigIntsToHex(vals []*big.Int) []string {
	out := make([]string, len(vals))
	for i, v := range vals {
		out[i] = fmt.Sprintf("0x%064x", v)
	}
	return out
}

func rawToBigInts(msgs []json.RawMessage) ([]*big.Int, error) {
	out := make([]*big.Int, len(msgs))
	for i, msg := range msgs {
		s := strings.Trim(string(msg), `"`)
		var n *big.Int
		var ok bool
		if strings.HasPrefix(s, "0x") || strings.HasPrefix(s, "0X") {
			n, ok = new(big.Int).SetString(s[2:], 16)
		} else {
			n, ok = new(big.Int).SetString(s, 10)
		}
		if !ok {
			return nil, fmt.Errorf("invalid number at index %d: %s", i, s)
		}
		out[i] = n
	}
	return out, nil
}

func initUser(s *sdk.SDK, user *User, execute bool) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Init, user.Index, int(nonce.Int64()), nil, nil)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForInit(cPrivateKey.CPrivateKey)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateInitProof(inputs)
		if err != nil {
			return err
		}
	}

	params := new(sdk.Params)
	initParams := params.GetInitParams(*proofOutput, nil)

	if execute {
		_, err = s.Token.CInit(user.Auth, initParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func deposit(s *sdk.SDK, user *User, execute bool) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Deposit, user.Index, int(nonce.Int64()), DepositAmount, nil)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForDeposit(user.Address, cPrivateKey.CPrivateKey, DepositAmount)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateUpdateProof(inputs)
		if err != nil {
			return err
		}
	}

	params := new(sdk.Params)
	depositParams := params.GetDepositParams(*proofOutput, nil)

	if execute {
		_, err = s.Token.CDeposit(user.Auth, depositParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func withdraw(s *sdk.SDK, user *User, execute bool) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Withdraw, user.Index, int(nonce.Int64()), WithdrawAmount, nil)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForWithdraw(user.Address, cPrivateKey.CPrivateKey, WithdrawAmount)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateUpdateProof(inputs)
		if err != nil {
			return err
		}
	}

	params := new(sdk.Params)
	withdrawParams := params.GetWithdrawParams(*proofOutput, nil)

	if execute {
		contract, err := confidential_transfers.NewConfidentialTransfers(s.TokenAddress, s.Client)
		if err != nil {
			return err
		}
		_, err = contract.CWithdraw(user.Auth, withdrawParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func mint(s *sdk.SDK, user *User, execute bool) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Mint, user.Index, int(nonce.Int64()), MintAmount, nil)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForMint(user.Address, cPrivateKey.CPrivateKey, MintAmount)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateUpdateProof(inputs)
		if err != nil {
			return err
		}
	}

	params := new(sdk.Params)
	mintParams := params.GetMintParams(*proofOutput, nil)

	if execute {
		contract, err := confidential_transfers.NewConfidentialTransfers(s.TokenAddress, s.Client)
		if err != nil {
			return err
		}
		_, err = contract.CMint(user.Auth, mintParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func burn(s *sdk.SDK, user *User, execute bool) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Burn, user.Index, int(nonce.Int64()), BurnAmount, nil)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForBurn(user.Address, cPrivateKey.CPrivateKey, BurnAmount)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateUpdateProof(inputs)
		if err != nil {
			return err
		}
	}

	params := new(sdk.Params)
	burnParams := params.GetBurnParams(*proofOutput, nil)

	if execute {
		contract, err := confidential_transfers.NewConfidentialTransfers(s.TokenAddress, s.Client)
		if err != nil {
			return err
		}
		_, err = contract.CBurn(user.Auth, burnParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func transfer(s *sdk.SDK, user *User, to *User, execute bool) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Transfer, user.Index, int(nonce.Int64()), TransferAmount, nil)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForTransfer(user.Address, cPrivateKey.CPrivateKey, to.Address, TransferAmount)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateTransferProof(inputs)
		if err != nil {
			return err
		}
	}

	params := new(sdk.Params)
	transferParams := params.GetTransferParams(to.Address, *proofOutput, nil, nil, nil)

	if execute {
		contract, err := confidential_transfers.NewConfidentialTransfers(s.TokenAddress, s.Client)
		if err != nil {
			return err
		}
		_, err = contract.CTransfer(user.Auth, transferParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func apply(s *sdk.SDK, user *User, execute bool, indexes []int) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Apply, user.Index, int(nonce.Int64()), nil, indexes)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForApply(user.Address, cPrivateKey.CPrivateKey, indexes)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateApplyProof(inputs)
		if err != nil {
			return err
		}
	}

	// Convert indexes to []*big.Int
	bigIndexes := make([]*big.Int, len(indexes))
	for i, v := range indexes {
		bigIndexes[i] = big.NewInt(int64(v))
	}

	params := new(sdk.Params)
	applyParams := params.GetApplyParams(bigIndexes, *proofOutput, nil)

	if execute {
		contract, err := confidential_transfers.NewConfidentialTransfers(s.TokenAddress, s.Client)
		if err != nil {
			return err
		}
		_, err = contract.CApply(user.Auth, applyParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func applyAndTransfer(s *sdk.SDK, user *User, to *User, execute bool, indexes []int) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(ApplyAndTransfer, user.Index, int(nonce.Int64()), nil, indexes)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForApplyAndTransfer(user.Address, cPrivateKey.CPrivateKey, indexes, to.Address, TransferAmount)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateApplyAndTransferProof(inputs)
		if err != nil {
			return err
		}
	}

	bigIndexes := make([]*big.Int, len(indexes))
	for i, v := range indexes {
		bigIndexes[i] = big.NewInt(int64(v))
	}

	params := new(sdk.Params)
	applyParams := params.GetApplyAndTransferParams(to.Address, bigIndexes, *proofOutput, nil, nil, nil)

	if execute {
		contract, err := confidential_transfers.NewConfidentialTransfers(s.TokenAddress, s.Client)
		if err != nil {
			return err
		}
		_, err = contract.CApplyAndTransfer(user.Auth, applyParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

func claim(s *sdk.SDK, user *User, execute bool, indexToClaim int) error {
	nonce, err := getNonce(s, user.Address)
	if err != nil {
		return err
	}
	filename := ProofFilenameForColdTest(Claim, user.Index, int(nonce.Int64()), nil, nil)

	if isFileExists(filename) && !execute {
		return nil
	}

	cPrivateKey, err := sdk.DeriveConfidentialKeys(user.PrivateKey.D)
	if err != nil {
		return err
	}

	inputs, err := s.GetCircuitInputsForClaim(user.Address, cPrivateKey.CPrivateKey, indexToClaim, nil)
	if err != nil {
		return err
	}

	var proofOutput *sdk.ProofOutput
	if isFileExists(filename) {
		proofOutput, err = getProofOutput(filename)
		if err != nil {
			return err
		}
	} else {
		proofOutput, err = s.GenerateClaimProof(inputs)
		if err != nil {
			return err
		}
	}

	params := new(sdk.Params)
	claimParams := params.GetClaimParams(*proofOutput, nil)

	if execute {
		contract, err := confidential_transfers_bridgeable.NewConfidentialTransfersBridgeable(s.TokenAddress, s.Client)
		if err != nil {
			return err
		}
		_, err = contract.CClaim(user.Auth, claimParams)
		if err != nil {
			return err
		}
	}
	saveProofToFile(filename, proofOutput)
	return nil
}

// Function to call addFailedCrossChainTransfer on Mock contract
func addFailedCrossChainTransfer(client *ethclient.Client, tokenAddress common.Address, user *User, recipient *User, nonce *big.Int, proof *sdk.ProofOutput) error {
	parsedABI, err := abi.JSON(strings.NewReader(mockAbiJSON))
	if err != nil {
		return fmt.Errorf("failed to parse mock ABI: %v", err)
	}

	// Construct PendingTransfer
	pt := PendingTransfer{
		Sender: user.Address,
		Payload: Payload{
			Nonce:      nonce,
			Commitment: proof.PubSignals[2],
			EAmount:    proof.PubSignals[3],
		},
		AuditReports: []AuditReport{},
	}

	// Get recipient (user2) public keys
	contract, err := confidential_transfers_bridgeable.NewConfidentialTransfersBridgeable(tokenAddress, client)
	if err != nil {
		return fmt.Errorf("failed to bind contract: %v", err)
	}

	recipientAccount, err := contract.GetAccount(nil, recipient.Address)
	if err != nil {
		return fmt.Errorf("failed to get recipient account: %v", err)
	}

	// Use bind.NewBoundContract to transact with the mock function
	boundContract := bind.NewBoundContract(tokenAddress, parsedABI, client, client, client)
	_, err = boundContract.Transact(recipient.Auth, "addFailedCrossChainTransfer",
		recipientAccount.PubKeyX,
		recipientAccount.PubKeyY,
		pt,
	)
	if err != nil {
		return fmt.Errorf("failed to send transaction: %v", err)
	}

	return nil
}

type Operation string

const (
	Init             Operation = "init"
	Deposit          Operation = "deposit"
	Transfer         Operation = "transfer"
	Apply            Operation = "apply"
	Withdraw         Operation = "withdraw"
	ApplyAndTransfer Operation = "applyAndTransfer"
	Claim            Operation = "claim"
	Mint             Operation = "mint"
	Burn             Operation = "burn"
)

func ProofFilenameForColdTest(operation Operation, userIndex int, nonce int, amount *big.Int, indexes []int) string {
	amountString := ""
	if amount != nil {
		amountString = fmt.Sprintf("-amount:%s", amount.String())
	}

	indexesString := ""
	if len(indexes) > 0 {
		strs := make([]string, len(indexes))
		for i, v := range indexes {
			strs[i] = fmt.Sprintf("%d", v)
		}
		indexesString = fmt.Sprintf("-indexes:[%s]", strings.Join(strs, ","))
	}

	return fmt.Sprintf("%s-user:%d-nonce:%d%s%s", operation, userIndex, nonce, amountString, indexesString)
}
