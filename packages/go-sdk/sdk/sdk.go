package sdk

import (
	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/ethclient"
	confidential_transfers "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfers"
	confidential_transfers_bridgeable "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfersBridgeable"
)

type SDK struct {
	Token           *confidential_transfers.ConfidentialTransfers
	TokenBridgeable *confidential_transfers_bridgeable.ConfidentialTransfersBridgeable
	Client          *ethclient.Client
	TokenAddress    common.Address
	prover          Prover
}

func NewSDK(tokenAddress common.Address, client *ethclient.Client, prover Prover, options SDKOptions) *SDK {
	token, err := confidential_transfers.NewConfidentialTransfers(tokenAddress, client)
	if err != nil {
		panic(err)
	}

	sdk := &SDK{
		Token:        token,
		Client:       client,
		TokenAddress: tokenAddress,
		prover:       prover,
	}

	if options.Type == SDKTypeConfidentialTransfersBridgeable {
		tokenBridgeable, err := confidential_transfers_bridgeable.NewConfidentialTransfersBridgeable(tokenAddress, client)
		if err != nil {
			panic(err)
		}
		sdk.TokenBridgeable = tokenBridgeable
	}

	return sdk
}
