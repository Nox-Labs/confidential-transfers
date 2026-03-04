package sdk

import "math/big"

type ProofOutput struct {
	Proof      []*big.Int `json:"proof"`
	PubSignals []*big.Int `json:"pubSignals"`
}

type Target struct {
	ChainId         *big.Int `json:"chainId"`
	ContractAddress *big.Int `json:"contractAddress"`
}

type CPrivateKey struct {
	CPrivateKey *big.Int `json:"cPrivateKey"`
}

type OldState struct {
	OldAmount     *big.Int `json:"oldAmount"`
	OldNonce      *big.Int `json:"oldNonce"`
	OldCommitment *big.Int `json:"oldCommitment"`
}

type CircuitInitInputs struct {
	Target
	CPrivateKey
}

type CircuitUpdateInputs struct {
	Target
	CPrivateKey
	OldState
	Operation *big.Int `json:"operation"`
	Amount    *big.Int `json:"amount"`
}

type CircuitTransferInputs struct {
	Target
	CPrivateKey
	OldState
	TransferAmount      *big.Int `json:"transferAmount"`
	RecipientPublicKeyX *big.Int `json:"recipientPublicKeyX"`
	RecipientPublicKeyY *big.Int `json:"recipientPublicKeyY"`
}

type CircuitApplyInputs struct {
	Target
	CPrivateKey
	OldState
	PendingTransfersAmounts     []*big.Int `json:"pendingTransfersAmounts"`
	PendingTransfersOTKs        []*big.Int `json:"pendingTransfersOTKs"`
	N                           *big.Int   `json:"n"`
	PendingTransfersCommitments []*big.Int `json:"pendingTransfersCommitments"`
}

type CircuitApplyAndTransferInputs struct {
	CircuitApplyInputs
	TransferAmount      *big.Int `json:"transferAmount"`
	RecipientPublicKeyX *big.Int `json:"recipientPublicKeyX"`
	RecipientPublicKeyY *big.Int `json:"recipientPublicKeyY"`
}

type CircuitClaimInputs struct {
	Target
	CPrivateKey
	OldState
	CPrivateKeyUsedInTransfer *big.Int `json:"cPrivateKeyUsedInTransfer"`
	RecipientPublicKeyX       *big.Int `json:"recipientPublicKeyX"`
	RecipientPublicKeyY       *big.Int `json:"recipientPublicKeyY"`
	PendingTransferNonce      *big.Int `json:"pendingTransferNonce"`
	PendingTransferAmount     *big.Int `json:"pendingTransferAmount"`
	PendingTransferCommitment *big.Int `json:"pendingTransferCommitment"`
}

type SDKType string

const (
	SDKTypeConfidentialTransfers           SDKType = "ConfidentialTransfers"
	SDKTypeConfidentialTransfersBridgeable SDKType = "ConfidentialTransfersBridgeable"
	SDKTypeConfidentialOFT                 SDKType = "ConfidentialOFT"
)

type SDKOptions struct {
	Type SDKType `json:"type"`
}
