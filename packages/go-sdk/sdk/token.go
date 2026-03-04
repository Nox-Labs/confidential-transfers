package sdk

import (
	"context"
	"math/big"

	"github.com/ethereum/go-ethereum/common"
)

func (s *SDK) CBalanceOf(address common.Address, cPrivateKey *big.Int) (*big.Int, error) {
	accountData, err := s.Token.GetAccount(nil, address)
	if err != nil {
		return nil, err
	}

	return s.DecryptAmount(
		cPrivateKey,
		accountData.State.Nonce,
		accountData.State.EAmount,
	)
}

func (s *SDK) GenerateOTK(key, nonce *big.Int) (*big.Int, error) {
	target := s.GetTarget()
	return GenerateOTK(key, nonce, target.ChainId, target.ContractAddress)
}

func (s *SDK) DecryptAmount(key, nonce, eAmount *big.Int) (*big.Int, error) {
	target := s.GetTarget()
	return DecryptAmount(key, nonce, eAmount, target.ChainId, target.ContractAddress)
}

func (s *SDK) GetTarget() Target {
	chainId, err := s.Client.ChainID(context.Background())
	if err != nil {
		panic(err)
	}
	return Target{
		ChainId:         chainId,
		ContractAddress: s.TokenAddress.Big(),
	}
}
