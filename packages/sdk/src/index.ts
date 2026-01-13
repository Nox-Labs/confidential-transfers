import { ethers } from "ethers"

import type { SDKOptions } from "./modules/types.js"
import * as SDKTypes from "./modules/types.js"
import { confidentialTransfersAbi } from "./artifacts/abi/ConfidentialTransfers.js"
import { confidentialOFTAbi } from "./artifacts/abi/ConfidentialOFT.js"
import { Utils } from "./modules/utils.js"
import { Params } from "./modules/params.js"

import type { MockERC20 as ERC20 } from "./artifacts/typechain/test/utils/mock/MockERC20.js"
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
} from "./artifacts/typechain/src/ConfidentialTransfers.js"
import * as ConfidentialTransfersTypechain from "./artifacts/typechain/src/ConfidentialTransfers.js"
import type {
  ConfidentialOFT,
  CSendParamsStruct as CSendParams,
} from "./artifacts/typechain/src/ConfidentialOFT.js"
import * as ConfidentialOFTTypechain from "./artifacts/typechain/src/ConfidentialOFT.js"

export {
  confidentialTransfersAbi,
  confidentialOFTAbi,
  ConfidentialTransfers,
  ConfidentialOFT,
  ERC20,
  Account,
  Payload,
  cInitParams,
  CSendParams,
  cApplyParams,
  cUpdateParams,
  cTransferParams,
  cApplyAndTransferParams,
  ProofOutput,
  Utils,
  ConfidentialTransfersTypechain,
  ConfidentialOFTTypechain,
  SDKTypes,
}

export class SDK extends Params {
  constructor(
    tokenAddress: string,
    rpcUrl: string | ethers.ContractRunner,
    options: SDKOptions
  ) {
    const runner =
      typeof rpcUrl === "string" ? new ethers.JsonRpcProvider(rpcUrl) : rpcUrl

    const func = options.isOFT
      ? SDK.getConfidentialOFTInstance
      : SDK.getConfidentialTransfersInstance

    super(func(tokenAddress, runner), options)
  }
}
