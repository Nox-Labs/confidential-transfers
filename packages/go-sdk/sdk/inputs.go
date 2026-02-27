package sdk

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	confidential_transfers "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfers"
)

const MAX_PENDING_TRANSFERS_APPLY = 10

func (s *SDK) GetCircuitInputsForInit(cPrivateKey *big.Int) (*CircuitInitInputs, error) {
	return &CircuitInitInputs{
		Target:      s.GetTarget(),
		CPrivateKey: CPrivateKey{CPrivateKey: cPrivateKey},
	}, nil
}

func (s *SDK) GetCircuitInputsForMint(account common.Address, cPrivateKey *big.Int, amount *big.Int) (*CircuitUpdateInputs, error) {
	return s.getCircuitInputsForUpdate(account, cPrivateKey, big.NewInt(0), amount)
}

func (s *SDK) GetCircuitInputsForBurn(account common.Address, cPrivateKey *big.Int, amount *big.Int) (*CircuitUpdateInputs, error) {
	return s.getCircuitInputsForUpdate(account, cPrivateKey, big.NewInt(1), amount)
}

func (s *SDK) GetCircuitInputsForDeposit(account common.Address, cPrivateKey *big.Int, amount *big.Int) (*CircuitUpdateInputs, error) {
	return s.getCircuitInputsForUpdate(account, cPrivateKey, big.NewInt(0), amount)
}

func (s *SDK) GetCircuitInputsForWithdraw(account common.Address, cPrivateKey *big.Int, amount *big.Int) (*CircuitUpdateInputs, error) {
	return s.getCircuitInputsForUpdate(account, cPrivateKey, big.NewInt(1), amount)
}

func (s *SDK) GetCircuitInputsForTransfer(account common.Address, cPrivateKey *big.Int, to common.Address, transferAmount *big.Int) (*CircuitTransferInputs, error) {
	accountData, err := s.Token.GetAccount(nil, account)
	if err != nil {
		return nil, err
	}

	oldNonce := accountData.State.Nonce
	oldAmount, err := s.DecryptAmount(cPrivateKey, oldNonce, accountData.State.EAmount)
	if err != nil {
		return nil, err
	}

	recipientAccount, err := s.Token.GetAccount(nil, to)
	if err != nil {
		return nil, err
	}

	return &CircuitTransferInputs{
		Target:      s.GetTarget(),
		CPrivateKey: CPrivateKey{CPrivateKey: cPrivateKey},
		OldState: OldState{
			OldAmount:     oldAmount,
			OldNonce:      oldNonce,
			OldCommitment: accountData.State.Commitment,
		},
		TransferAmount:      transferAmount,
		RecipientPublicKeyX: recipientAccount.PubKeyX,
		RecipientPublicKeyY: recipientAccount.PubKeyY,
	}, nil
}

func (s *SDK) GetCircuitInputsForApply(account common.Address, cPrivateKey *big.Int, pendingTransfersIndexes []int) (*CircuitApplyInputs, error) {
	if len(pendingTransfersIndexes) > MAX_PENDING_TRANSFERS_APPLY {
		return nil, fmt.Errorf("max pending transfers apply is %d", MAX_PENDING_TRANSFERS_APPLY)
	}

	target := s.GetTarget()

	senderAccountData, err := s.Token.GetAccount(nil, account)
	if err != nil {
		return nil, err
	}

	oldNonce := senderAccountData.State.Nonce
	oldAmount, err := s.DecryptAmount(cPrivateKey, oldNonce, senderAccountData.State.EAmount)
	if err != nil {
		return nil, err
	}

	// Filter pending transfers
	var filteredPendingTransfers []confidential_transfers.PendingTransfer
	for _, idx := range pendingTransfersIndexes {
		if idx >= len(senderAccountData.PendingTransfers) {
			return nil, fmt.Errorf("index out of bounds")
		}
		filteredPendingTransfers = append(filteredPendingTransfers, senderAccountData.PendingTransfers[idx])
	}

	// Get public keys of senders
	var senders []common.Address
	for _, transfer := range filteredPendingTransfers {
		senders = append(senders, transfer.Sender)
	}

	keys, err := s.Token.GetCPublicKeys(nil, senders)
	if err != nil {
		return nil, err
	}
	pubKeyXs := keys.PubKeyXs
	pubKeyYs := keys.PubKeyYs

	// Decrypt amounts and generate OTKs
	type transferData struct {
		Amount *big.Int
		OTK    *big.Int
	}

	var decryptedAmountsWithOTKs []transferData
	for idx, transfer := range filteredPendingTransfers {
		pubKeyX := pubKeyXs[idx]
		pubKeyY := pubKeyYs[idx]

		sharedKey, err := DeriveSharedKey(cPrivateKey, pubKeyX, pubKeyY)
		if err != nil {
			return nil, err
		}

		otk, err := GenerateOTK(sharedKey, transfer.Payload.Nonce, target.ChainId, target.ContractAddress)
		if err != nil {
			return nil, err
		}

		amount, err := Decipher(otk, transfer.Payload.Nonce, transfer.Payload.EAmount)
		if err != nil {
			return nil, err
		}

		decryptedAmountsWithOTKs = append(decryptedAmountsWithOTKs, transferData{Amount: amount, OTK: otk})
	}

	// Prepare circuit inputs arrays (padded)
	pendingTransfersCommitments := make([]*big.Int, MAX_PENDING_TRANSFERS_APPLY)
	pendingTransfersAmounts := make([]*big.Int, MAX_PENDING_TRANSFERS_APPLY)
	pendingTransfersOTKs := make([]*big.Int, MAX_PENDING_TRANSFERS_APPLY)

	zero := big.NewInt(0)

	for j := 0; j < MAX_PENDING_TRANSFERS_APPLY; j++ {
		if j < len(filteredPendingTransfers) {
			pendingTransfersCommitments[j] = filteredPendingTransfers[j].Payload.Commitment
			pendingTransfersAmounts[j] = decryptedAmountsWithOTKs[j].Amount
			pendingTransfersOTKs[j] = decryptedAmountsWithOTKs[j].OTK
		} else {
			pendingTransfersCommitments[j] = zero
			pendingTransfersAmounts[j] = zero
			pendingTransfersOTKs[j] = zero
		}
	}

	n := big.NewInt(int64(len(pendingTransfersIndexes)))

	return &CircuitApplyInputs{
		Target:      target,
		CPrivateKey: CPrivateKey{CPrivateKey: cPrivateKey},
		OldState: OldState{
			OldAmount:     oldAmount,
			OldNonce:      oldNonce,
			OldCommitment: senderAccountData.State.Commitment,
		},
		PendingTransfersAmounts:     pendingTransfersAmounts,
		PendingTransfersOTKs:        pendingTransfersOTKs,
		N:                           n,
		PendingTransfersCommitments: pendingTransfersCommitments,
	}, nil
}

func (s *SDK) GetCircuitInputsForApplyAndTransfer(account common.Address, cPrivateKey *big.Int, pendingTransfersIndexes []int, to common.Address, transferAmount *big.Int) (*CircuitApplyAndTransferInputs, error) {
	applyInputs, err := s.GetCircuitInputsForApply(account, cPrivateKey, pendingTransfersIndexes)
	if err != nil {
		return nil, err
	}

	transferInputs, err := s.GetCircuitInputsForTransfer(account, cPrivateKey, to, transferAmount)
	if err != nil {
		return nil, err
	}

	return &CircuitApplyAndTransferInputs{
		CircuitApplyInputs:  *applyInputs,
		TransferAmount:      transferInputs.TransferAmount,
		RecipientPublicKeyX: transferInputs.RecipientPublicKeyX,
		RecipientPublicKeyY: transferInputs.RecipientPublicKeyY,
	}, nil
}

func (s *SDK) GetCircuitInputsForClaim(account common.Address, cPrivateKey *big.Int, indexToClaim int, cPrivateKeyUsedInTransfer *big.Int) (*CircuitClaimInputs, error) {
	if cPrivateKeyUsedInTransfer == nil {
		cPrivateKeyUsedInTransfer = cPrivateKey
	}

	failedCrossChainTransfers, err := s.TokenBridgeable.GetFailedCrossChainTransfers(nil, account)
	if err != nil {
		return nil, err
	}

	if indexToClaim >= len(failedCrossChainTransfers) {
		return nil, fmt.Errorf("index out of bounds")
	}

	transferToClaim := failedCrossChainTransfers[indexToClaim]

	accountData, err := s.Token.GetAccount(nil, account)
	if err != nil {
		return nil, err
	}

	oldNonce := accountData.State.Nonce
	oldAmount, err := s.DecryptAmount(cPrivateKey, oldNonce, accountData.State.EAmount)
	if err != nil {
		return nil, err
	}

	sharedKey, err := DeriveSharedKey(cPrivateKeyUsedInTransfer, transferToClaim.RecipientPubKeyX, transferToClaim.RecipientPubKeyY)
	if err != nil {
		return nil, err
	}

	amount, err := s.DecryptAmount(sharedKey, transferToClaim.PendingTransfer.Payload.Nonce, transferToClaim.PendingTransfer.Payload.EAmount)
	if err != nil {
		return nil, err
	}

	return &CircuitClaimInputs{
		Target: Target{
			ChainId:         s.GetTarget().ChainId,
			ContractAddress: s.GetTarget().ContractAddress,
		},
		CPrivateKey: CPrivateKey{CPrivateKey: cPrivateKey},
		OldState: OldState{
			OldAmount:     oldAmount,
			OldNonce:      oldNonce,
			OldCommitment: accountData.State.Commitment,
		},
		CPrivateKeyUsedInTransfer: cPrivateKeyUsedInTransfer,
		RecipientPublicKeyX:       transferToClaim.RecipientPubKeyX,
		RecipientPublicKeyY:       transferToClaim.RecipientPubKeyY,
		PendingTransferNonce:      transferToClaim.PendingTransfer.Payload.Nonce,
		PendingTransferAmount:     amount,
		PendingTransferCommitment: transferToClaim.PendingTransfer.Payload.Commitment,
	}, nil
}

func (s *SDK) getCircuitInputsForUpdate(account common.Address, cPrivateKey *big.Int, operation *big.Int, amount *big.Int) (*CircuitUpdateInputs, error) {
	accountData, err := s.Token.GetAccount(nil, account)
	if err != nil {
		return nil, err
	}

	oldNonce := accountData.State.Nonce
	oldAmount, err := s.DecryptAmount(cPrivateKey, oldNonce, accountData.State.EAmount)
	if err != nil {
		return nil, err
	}

	return &CircuitUpdateInputs{
		Target:      s.GetTarget(),
		CPrivateKey: CPrivateKey{CPrivateKey: cPrivateKey},
		OldState: OldState{
			OldAmount:     oldAmount,
			OldNonce:      oldNonce,
			OldCommitment: accountData.State.Commitment,
		},
		Operation: operation,
		Amount:    amount,
	}, nil
}
