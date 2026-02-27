package sdk

import (
	"fmt"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	confidential_transfers "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfers"
)

func (s *SDK) CreateStateAuditReport(cPrivateKey *big.Int, nonce *big.Int, auditorAddresses []common.Address) ([]confidential_transfers.AuditReport, error) {
	otk, err := s.GenerateOTK(cPrivateKey, nonce)
	if err != nil {
		return nil, err
	}
	return s.createAuditReport(cPrivateKey, otk, nonce, auditorAddresses)
}

func (s *SDK) CreateTransferAuditReport(cPrivateKey *big.Int, nonce *big.Int, recipientAddress common.Address, auditorAddresses []common.Address) ([]confidential_transfers.AuditReport, error) {
	account, err := s.Token.GetAccount(nil, recipientAddress)
	if err != nil {
		return nil, err
	}

	sharedKey, err := DeriveSharedKey(cPrivateKey, account.PubKeyX, account.PubKeyY)
	if err != nil {
		return nil, err
	}

	otk, err := s.GenerateOTK(sharedKey, nonce)
	if err != nil {
		return nil, err
	}

	return s.createAuditReport(cPrivateKey, otk, nonce, auditorAddresses)
}

func (s *SDK) createAuditReport(cPrivateKey *big.Int, otk *big.Int, nonce *big.Int, auditorAddresses []common.Address) ([]confidential_transfers.AuditReport, error) {
	keys, err := s.Token.GetCPublicKeys(nil, auditorAddresses)
	if err != nil {
		return nil, err
	}

	pubKeyXs := keys.PubKeyXs
	pubKeyYs := keys.PubKeyYs

	var stateAuditReports []confidential_transfers.AuditReport

	for i, auditorAddress := range auditorAddresses {
		sharedKey, err := DeriveSharedKey(cPrivateKey, pubKeyXs[i], pubKeyYs[i])
		if err != nil {
			return nil, err
		}

		eOTK, err := Cipher(sharedKey, nonce, otk)
		if err != nil {
			return nil, err
		}

		stateAuditReports = append(stateAuditReports, confidential_transfers.AuditReport{
			Auditor: auditorAddress,
			EOTK:    eOTK,
		})
	}

	return stateAuditReports, nil
}

func (s *SDK) DecryptAuditReport(cPrivateKey *big.Int, senderAddress common.Address, eOTK *big.Int, payload confidential_transfers.Payload) (*big.Int, error) {
	account, err := s.Token.GetAccount(nil, senderAddress)
	if err != nil {
		return nil, err
	}

	sharedKey, err := DeriveSharedKey(cPrivateKey, account.PubKeyX, account.PubKeyY)
	if err != nil {
		return nil, err
	}

	otk, err := Decipher(sharedKey, payload.Nonce, eOTK)
	if err != nil {
		return nil, err
	}

	amount, err := Decipher(otk, payload.Nonce, payload.EAmount)
	if err != nil {
		return nil, err
	}

	commitment, err := GenerateCommitment(amount, otk)
	if err != nil {
		return nil, err
	}

	if commitment.Cmp(payload.Commitment) != 0 {
		return nil, fmt.Errorf("commitment payload does not match")
	}

	return amount, nil
}
