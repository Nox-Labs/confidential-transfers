import {
  ApplyAndTransferParamsStruct,
  ApplyParamsStruct,
  AuditReportStruct,
  InitParamsStruct,
  TransferParamsStruct,
  UpdateParamsStruct,
} from "../artifacts/typechain/src/ConfidentialTransfers.js"
import { ClaimParamsStruct } from "../artifacts/typechain/src/ConfidentialTransfersBridgeable.js"
import { ProofOutput } from "./types.js"
import { Auditors } from "./auditors.js"

export class Params extends Auditors {
  getInitParams(
    output: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
  ): InitParamsStruct {
    return {
      stateAuditReports: stateAuditReports ?? [],
      artifacts: {
        proof: output.proof,
        outputs: output.pubSignals.slice(0, 4),
      },
    }
  }

  getWithdrawParams(
    proofOutput: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
  ): UpdateParamsStruct {
    return this.getUpdateParams(proofOutput, stateAuditReports)
  }

  getDepositParams(
    proofOutput: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
  ): UpdateParamsStruct {
    return this.getUpdateParams(proofOutput, stateAuditReports)
  }

  getApplyParams(
    pendingTransfersIndexes: number[],
    proofOutput: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
  ): ApplyParamsStruct {
    return {
      pendingTransfersIndexes,
      stateAuditReports: stateAuditReports ?? [],
      artifacts: {
        proof: proofOutput.proof,
        outputs: proofOutput.pubSignals.slice(0, 2),
      },
    }
  }

  getTransferParams(
    recipientAddress: string,
    proofOutput: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
    transferAuditReports?: AuditReportStruct[],
    extraData?: string,
  ): TransferParamsStruct {
    return {
      recipient: recipientAddress,
      stateAuditReports: stateAuditReports ?? [],
      transferAuditReports: transferAuditReports ?? [],
      extraData: extraData ?? "0x",
      artifacts: {
        proof: proofOutput.proof,
        outputs: proofOutput.pubSignals.slice(0, 4),
      },
    }
  }

  getApplyAndTransferParams(
    recipientAddress: string,
    pendingTransfersIndexes: number[],
    proofOutput: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
    transferAuditReports?: AuditReportStruct[],
    extraData?: string,
  ): ApplyAndTransferParamsStruct {
    return {
      recipient: recipientAddress,
      pendingTransfersIndexes,
      stateAuditReports: stateAuditReports ?? [],
      transferAuditReports: transferAuditReports ?? [],
      extraData: extraData ?? "0x",
      artifacts: {
        proof: proofOutput.proof,
        outputs: proofOutput.pubSignals.slice(0, 4),
      },
    }
  }

  getClaimParams(
    indexToClaim: number,
    proofOutput: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
  ): ClaimParamsStruct {
    return {
      indexToClaim,
      artifacts: {
        proof: proofOutput.proof,
        outputs: proofOutput.pubSignals.slice(0, 2),
      },
      stateAuditReports: stateAuditReports ?? [],
    }
  }

  private getUpdateParams(
    output: ProofOutput,
    stateAuditReports?: AuditReportStruct[],
  ): UpdateParamsStruct {
    return {
      amount: output.pubSignals[5],
      stateAuditReports: stateAuditReports ?? [],
      artifacts: {
        proof: output.proof,
        outputs: output.pubSignals.slice(0, 2),
      },
    }
  }
}
