import { ethers } from "ethers"

import type { SDKOptions } from "./modules/types.js"
import * as SDKTypes from "./modules/types.js"
import { confidentialTransfersAbi } from "./artifacts/abi/ConfidentialTransfers.js"
import { confidentialOFTAbi } from "./artifacts/abi/ConfidentialOFT.js"
import { Utils } from "./modules/utils.js"
import { Params } from "./modules/params.js"

import type { ProofOutput } from "./modules/types.js"
import type {
  ConfidentialTransfers,
  AccountStruct as Account,
  PayloadStruct as Payload,
  InitParamsStruct as cInitParams,
  ApplyParamsStruct as cApplyParams,
  UpdateParamsStruct as cUpdateParams,
  TransferParamsStruct as cTransferParams,
  ApplyAndTransferParamsStruct as cApplyAndTransferParams,
  PendingTransferStruct as PendingTransfer,
  AuditReportStruct as AuditReport,
  ZKArtifactsStruct as ZKArtifacts,
  PayloadStructOutput as PayloadOutput,
} from "./artifacts/typechain/src/ConfidentialTransfers.js"
import * as ConfidentialTransfersTypechain from "./artifacts/typechain/src/ConfidentialTransfers.js"
import type {
  ConfidentialOFT,
  CSendParamsStruct as CSendParams,
} from "./artifacts/typechain/src/ConfidentialOFT.js"
import * as ConfidentialOFTTypechain from "./artifacts/typechain/src/ConfidentialOFT.js"
import type {
  ConfidentialTransfersBridgeable,
  ClaimParamsStruct as cClaimParams,
} from "./artifacts/typechain/src/ConfidentialTransfersBridgeable.js"
import * as ConfidentialTransfersBridgeableTypechain from "./artifacts/typechain/src/ConfidentialTransfersBridgeable.js"
import { confidentialTransfersBridgeableAbi } from "./artifacts/abi/ConfidentialTransfersBridgeable.js"

export {
  confidentialTransfersAbi,
  confidentialTransfersBridgeableAbi,
  confidentialOFTAbi,
  ConfidentialTransfers,
  ConfidentialTransfersBridgeable,
  ConfidentialOFT,
  Account,
  Payload,
  cInitParams,
  CSendParams,
  cApplyParams,
  cUpdateParams,
  cTransferParams,
  cApplyAndTransferParams,
  cClaimParams,
  PendingTransfer,
  AuditReport,
  ZKArtifacts,
  PayloadOutput,
  ProofOutput,
  Utils,
  ConfidentialTransfersTypechain,
  ConfidentialOFTTypechain,
  ConfidentialTransfersBridgeableTypechain,
  SDKTypes,
}

export class SDK extends Params {
  constructor(
    tokenAddress: string,
    rpcUrl: string | ethers.ContractRunner,
    options: SDKOptions,
  ) {
    const runner =
      typeof rpcUrl === "string" ? new ethers.JsonRpcProvider(rpcUrl) : rpcUrl

    const func =
      options.type === "ConfidentialOFT"
        ? SDK.getConfidentialOFTInstance
        : options.type === "ConfidentialTransfersBridgeable"
          ? SDK.getConfidentialTransfersBridgeableInstance
          : SDK.getConfidentialTransfersInstance

    super(func(tokenAddress, runner), options)
  }
}
