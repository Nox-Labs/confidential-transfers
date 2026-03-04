package sdk

import (
	"math/big"

	"github.com/ethereum/go-ethereum/common"
	confidential_transfers "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfers"
	confidential_transfers_bridgeable "github.com/noxlabs/confidential-transfers-go-sdk/sdk/artifacts/contracts/ConfidentialTransfersBridgeable"
)

type Params struct{}

func (p *Params) GetInitParams(output ProofOutput, stateAuditReports []confidential_transfers.AuditReport) confidential_transfers.InitParams {
	if stateAuditReports == nil {
		stateAuditReports = []confidential_transfers.AuditReport{}
	}
	return confidential_transfers.InitParams{
		StateAuditReports: stateAuditReports,
		Artifacts: confidential_transfers.ZKArtifacts{
			Proof:   output.Proof,
			Outputs: output.PubSignals[:4],
		},
	}
}

func (p *Params) GetMintParams(output ProofOutput, stateAuditReports []confidential_transfers.AuditReport) confidential_transfers.UpdateParams {
	return p.getUpdateParams(output, stateAuditReports)
}

func (p *Params) GetBurnParams(output ProofOutput, stateAuditReports []confidential_transfers.AuditReport) confidential_transfers.UpdateParams {
	return p.getUpdateParams(output, stateAuditReports)
}

func (p *Params) GetWithdrawParams(output ProofOutput, stateAuditReports []confidential_transfers.AuditReport) confidential_transfers.UpdateParams {
	return p.getUpdateParams(output, stateAuditReports)
}

func (p *Params) GetDepositParams(output ProofOutput, stateAuditReports []confidential_transfers.AuditReport) confidential_transfers.UpdateParams {
	return p.getUpdateParams(output, stateAuditReports)
}

func (p *Params) GetTransferParams(recipient common.Address, output ProofOutput, stateAuditReports []confidential_transfers.AuditReport, transferAuditReports []confidential_transfers.AuditReport, extraData []byte) confidential_transfers.TransferParams {
	if stateAuditReports == nil {
		stateAuditReports = []confidential_transfers.AuditReport{}
	}
	if transferAuditReports == nil {
		transferAuditReports = []confidential_transfers.AuditReport{}
	}
	if extraData == nil {
		extraData = []byte{}
	}

	return confidential_transfers.TransferParams{
		Recipient:            recipient,
		StateAuditReports:    stateAuditReports,
		TransferAuditReports: transferAuditReports,
		ExtraData:            extraData,
		Artifacts: confidential_transfers.ZKArtifacts{
			Proof:   output.Proof,
			Outputs: output.PubSignals[:4],
		},
	}
}

func (p *Params) GetApplyParams(pendingTransfersIndexes []*big.Int, output ProofOutput, stateAuditReports []confidential_transfers.AuditReport) confidential_transfers.ApplyParams {
	if stateAuditReports == nil {
		stateAuditReports = []confidential_transfers.AuditReport{}
	}

	return confidential_transfers.ApplyParams{
		PendingTransfersIndexes: pendingTransfersIndexes,
		StateAuditReports:       stateAuditReports,
		Artifacts: confidential_transfers.ZKArtifacts{
			Proof:   output.Proof,
			Outputs: output.PubSignals[:2],
		},
	}
}

func (p *Params) GetApplyAndTransferParams(recipient common.Address, pendingTransfersIndexes []*big.Int, output ProofOutput, stateAuditReports []confidential_transfers.AuditReport, transferAuditReports []confidential_transfers.AuditReport, extraData []byte) confidential_transfers.ApplyAndTransferParams {
	if stateAuditReports == nil {
		stateAuditReports = []confidential_transfers.AuditReport{}
	}
	if transferAuditReports == nil {
		transferAuditReports = []confidential_transfers.AuditReport{}
	}
	if extraData == nil {
		extraData = []byte{}
	}

	return confidential_transfers.ApplyAndTransferParams{
		Recipient:               recipient,
		PendingTransfersIndexes: pendingTransfersIndexes,
		StateAuditReports:       stateAuditReports,
		TransferAuditReports:    transferAuditReports,
		ExtraData:               extraData,
		Artifacts: confidential_transfers.ZKArtifacts{
			Proof:   output.Proof,
			Outputs: output.PubSignals[:4],
		},
	}
}

func (p *Params) GetClaimParams(output ProofOutput, stateAuditReports []confidential_transfers_bridgeable.AuditReport) confidential_transfers_bridgeable.ClaimParams {
	if stateAuditReports == nil {
		stateAuditReports = []confidential_transfers_bridgeable.AuditReport{}
	}
	return confidential_transfers_bridgeable.ClaimParams{
		StateAuditReports: stateAuditReports,
		Artifacts: confidential_transfers_bridgeable.ZKArtifacts{
			Proof:   output.Proof,
			Outputs: output.PubSignals[:2],
		},
	}
}

func (p *Params) getUpdateParams(output ProofOutput, stateAuditReports []confidential_transfers.AuditReport) confidential_transfers.UpdateParams {
	if stateAuditReports == nil {
		stateAuditReports = []confidential_transfers.AuditReport{}
	}

	return confidential_transfers.UpdateParams{
		Amount:            output.PubSignals[5],
		StateAuditReports: stateAuditReports,
		Artifacts: confidential_transfers.ZKArtifacts{
			Proof:   output.Proof,
			Outputs: output.PubSignals[:2],
		},
	}
}
