import { ethers } from "ethers"

import { SDKOptions } from "./modules/types.js"
import { confidentialTransfersAbi } from "../artifacts/abi/ConfidentialTransfers.js"
import { Utils } from "./modules/utils.js"
import { Params } from "./modules/params.js"

import type { MockERC20 as ERC20 } from "../artifacts/typechain/test/utils/mock/MockERC20.js"
import type {
  ConfidentialTransfers,
  AccountStruct as Account,
  PayloadStruct as Payload,
  InitParamsStruct as cInitParams,
  ApplyParamsStruct as cApplyParams,
  UpdateParamsStruct as cUpdateParams,
  TransferParamsStruct as cTransferParams,
} from "../artifacts/typechain/src/ConfidentialTransfers.js"

export {
  confidentialTransfersAbi,
  ConfidentialTransfers,
  ERC20,
  Account,
  Payload,
  cInitParams,
  cApplyParams,
  cUpdateParams,
  cTransferParams,
  Utils,
}

export class SDK extends Params {
  constructor(
    tokenAddress: string,
    rpcUrl: string | ethers.ContractRunner,
    options: SDKOptions
  ) {
    const runner =
      typeof rpcUrl === "string" ? new ethers.JsonRpcProvider(rpcUrl) : rpcUrl

    super(SDK.getContractInstance(tokenAddress, runner), options)
  }

  static getContractInstance(
    tokenAddress: string,
    runner: ethers.ContractRunner
  ): ConfidentialTransfers {
    return new ethers.Contract(
      tokenAddress,
      confidentialTransfersAbi,
      runner
    ) as unknown as ConfidentialTransfers
  }
}
