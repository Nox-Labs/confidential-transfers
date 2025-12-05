import { ethers } from "ethers"
import { Inputs } from "./modules/inputs.js"
import type {
  ConfidentialTransfers,
  AccountStruct as Account,
  PackageStructOutput as Package,
  InitParamsStruct as cInitParams,
  ApplyParamsStruct as cApplyParams,
  UpdateParamsStruct as cUpdateParams,
  TransferParamsStruct as cTransferParams,
} from "../artifacts/typechain/src/ConfidentialTransfers.js"
import type { MockERC20 as ERC20 } from "../artifacts/typechain/test/mock/MockERC20.js"
import { SDKOptions } from "./modules/types.js"
import { confidentialTransfersAbi } from "../artifacts/abi/ConfidentialTransfers.js"
import { Utils } from "./modules/utils.js"

export {
  confidentialTransfersAbi,
  ConfidentialTransfers,
  ERC20,
  Account,
  Package,
  cInitParams,
  cApplyParams,
  cUpdateParams,
  cTransferParams,
  Utils,
}

export class ConfidentialTransfersSDK extends Inputs {
  constructor(
    tokenAddress: string,
    rpcUrl: string | ethers.ContractRunner,
    options: SDKOptions
  ) {
    const runner =
      typeof rpcUrl === "string" ? new ethers.JsonRpcProvider(rpcUrl) : rpcUrl

    super(
      ConfidentialTransfersSDK.getContractInstance(tokenAddress, runner),
      options
    )
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
